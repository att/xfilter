function xfilter(server) {
    var _engine;
    var _fields, _xform, _filters = {}, _groups = {}, _data, _group_id = 17;
    var _start_time, _resolution; // in ms (since epoch for start)

    function query_url(q) {
        return server + '/' + q;
    }

    function create_group(dimension) {
        var _id = _group_id++, _anchor = {id: _id, dimension: dimension, values: null, splitter: 'a'};
        _groups[_id] = _anchor;
        var group = {
            categorical: function() {
                // unclear how much engines will share impl
                return this;
            },
            dispose: function() {
                delete _groups[_id];
                _anchor.values = null;
                return this;
            },
            all: function() {
                return _anchor.values;
            }
        };
        if(xf.engine().augment_group)
            group = xf.engine().augment_group(_anchor, group);
        return group;
    }

    var xf = {};

    xf.dimension = function(field) {
        if(!Object.keys(_fields).length)
            throw new Error('no schema (not started)');
        if(!_fields[field])
            throw new Error('field ' + field + ' not found in schema');

        function toValues(v) {
            if(!_xform[field])
                return v;
            if(v instanceof Array)
                return v.map(toValues);
            return _xform[field].to(v);
        }

        return {
            filter: function(v) {
                if(v !== null)
                    throw new Error('unexpected non-null filter()');
                delete _filters[field];
                return this;
            },
            filterExact: function(val) {
                val = toValues(val);
                _filters[field] = {type: 'set', target: [val]};
                return this;
            },
            filterMultiple: function(vals) { // not in ordinary crossfilter
                vals = toValues(vals);
                _filters[field] = {type: 'set', target: vals};
                return this;
            },
            filterRange: function(range) {
                range = toValues(range);
                _filters[field] = {type: 'interval', target: range};
                return this;
            },
            filterFunction: function() {
                throw new Error('filter functions not allowed');
            },
            dispose: function() {
                this.filter(null);
                return this;
            },
            group: function() {
                return create_group(field);
            }
        };
    };

    function validate(data) {
        function expect() {
            var d = data;
            for(var i = 0; i < arguments.length; ++i) {
                if(!d[arguments[i]]) {
                    console.log('expected data.' + Array.prototype.slice.call(arguments, 0, i).join('.'));
                    return false;
                }
                d = d[arguments[i]];
            }
            return true;
        }
        expect('layers');
        expect('root', 'children');
    }

    function key_ascending(a, b) { // adapted from d3.ascending
        return a.key < b.key ? -1 : a.key > b.key ? 1 : a.key >= b.key ? 0 : NaN;
    }

    xf.commit = function() {
        var ids = Object.keys(_groups), qs = [];
        for(var id in _groups)
            qs.push(xf.engine().do_query(query_url, _filters, _groups[id]));
        return Promise.all(qs).then(function(results) {
            if(results.length !== qs.length)
                throw new Error('unexpected number of results ' + results.length);

            for(var i = 0; i < results.length; ++i) {
                var result = results[i],
                    id = ids[i],
                    group = _groups[id],
                    xform = _xform[group.dimension];
                group.values = xf.engine()
                    .unpack_result(result)
                    .sort(key_ascending)
                    .map(function(kv) {
                        return {key: xform ? xform.fro(kv.key) : kv.key, value: kv.value};
                    });
            }
            if(validate(result))
                _data = result;
            return results;
        });
    };

    xf.engine = function(_) {
        if(!arguments.length)
            return _engine;
        _engine = _;
        return xf;
    };

    xf.start = function() {
        return xf.engine().fetch_schema(query_url).then(function(result) {
            ({fields: _fields, xform: _xform} = result);
            _xform = _xform || {};
        });
    };

    return xf;
}
