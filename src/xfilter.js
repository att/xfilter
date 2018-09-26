function xfilter(server) {
    var _engine;
    var _schema, _fields, _xform, _filters = {}, _groups = {}, _data, _group_id = 17;
    var _start_time, _resolution; // in ms (since epoch for start)

    function query_url(q) {
        return server + '/' + q;
    }

    function do_query(q, k) {
        return d3.json(query_url(q));
    }

    function do_queries(qs, k) {
        return Promise.all(qs.map(function(q) {
            return d3.json(query_url(q));
        }));
    }

    function create_group(dimension) {
        var _id = _group_id++, _anchor = {id: _id, dimension: dimension, values: null, splitter: 'a'};
        _groups[_id] = _anchor;

        function arg_printer(name /* ... */) {
            var args = Array.prototype.slice.call(arguments, 1);
            return function() {
                return name + '(' + args.map(JSON.stringify).join(',') + ')';
            };
        }
        return {
            // native interface
            mt_interval_sequence: function(start, binwid, len) { // ints
                _anchor.print = arg_printer('mt_interval_sequence', start, binwid, len);
                _anchor.splitter = 'r';
                return this;
            },
            dive: function(bins, depth) {
                _anchor.print = arg_printer('dive', bins, depth);
                _anchor.splitter = 'a';
                return this;
            },
            // somewhat nicer interface
            time: function(start, binwid, len) { // Date, ms, number
                start = start ? start.getTime() : _start_time;
                binwid = binwid || _resolution;
                len = len || 10*365;
                var startb = (start - _start_time)/_resolution,
                    widb = binwid/_resolution;
                this.mt_interval_sequence(startb, widb, len);
                return this;
            },
            categorical: function() {
                this.dive([], 1);
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
    }

    var xf = {};

    xf.dimension = function(field) {
        if(!_schema)
            throw new Error('no schema');
        if(!_schema.fields.find(function(f) { return f.name === field; }))
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
            filterMultiple: function(vals) { // unique to nanocubes
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

    xf.commit = function(k) {
        var ids = Object.keys(_groups), qs = [];
        for(var id in _groups)
            qs.push(xf.engine().build_query(_filters, _groups[id]));
        do_queries(qs).then(function(results) {
            if(results.length !== qs.length + 1)
                throw new Error('unexpected number of results ' + results.length);

            for(var i = 1; i < results.length; ++i) {
                var result = results[i],
                    id = ids[i-1],
                    group = _groups[id],
                    xform = _xform[group.dimension];
                group.values = result.root.children.map(function(pv) {
                    return {key: pv.path[0], value: pv.val};
                })
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
        xf.engine().fetch_schema(do_query).then(function(result) {
            {_schema, _fields, _xform} = result;
        });
    };

    return xf;
}
