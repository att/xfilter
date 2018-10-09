/*!
 *  xfilter 0.2.2
 *  http://att.github.io/xfilter/
 *  Copyright (c) 2012-2013 AT&T Intellectual Property
 *
 *  Licensed under the MIT License
 *  https://github.com/att/xfilter/blob/master/LICENSE
 */
(function() { function _xfilter() {
'use strict';

xfilter.version = '0.2.2';


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

xfilter.nanocube_queries = function() {
    var _start_time, _resolution;
    function ms_mult(suffix) {
        var mult = 1;
        switch(suffix) {
        case 'w': mult *= 7;
        case 'd': mult *= 24;
        case 'h': mult *= 60;
        case 'm': mult *= 60;
        case 's': return mult*1000;
        default: return NaN;
        }
    }
    return {
        do_query: function(query_url, filters, group) {
            var parts = ['count'];
            for(var f in filters) {
                if(group && group.dimension === f)
                    continue;
                var filter;
                switch(filters[f].type) {
                case 'set':
                    filter = 'set(' + filters[f].target.join(',') + ')';
                    break;
                case 'interval':
                    filter = 'interval(' + filters[f].target.join(',') + ')';
                    break;
                }
                parts.push('.r("' + f + '",' + filter + ')');
            }
            if(group.print)
                parts.push('.' + group.splitter + '("' + group.dimension + '",' + group.print() + ')');
            return d3.json(query_url(parts.join('')));
        },
        unpack_result: function(result) {
            return result.root.children.map(function(pv) {
                return {key: pv.path[0], value: pv.val};
            });
        },
        fetch_schema: function(query_url) {
            return d3.json(query_url('schema')).then(function(schema) {
                var fields = {}, xform = {};
                schema.fields.forEach(function(f) {
                    fields[f.name] = f;
                    if(/^nc_dim_cat_/.test(f.type)) {
                        var vn = [];
                        for(var vname in f.valnames)
                            vn[f.valnames[vname]] = vname;
                        xform[f.name] = {
                            to: function(v) {
                                return f.valnames[v];
                            },
                            fro: function(v) {
                                return vn[v] || 'foo';
                            }
                        };
                    }
                    else if(/^nc_dim_time_/.test(f.type)) {
                        xform[f.name] = {
                            to: function(v) {
                                return Math.round((v.getTime() - _start_time)/_resolution);
                            },
                            fro: function(v) {
                                return new Date(_start_time + v * _resolution);
                            }
                        };
                    }
                });
                schema.metadata.forEach(function(m) {
                    if(m.key === 'tbin') {
                        var parts = m.value.split('_');
                        _start_time = Date.parse(parts[0] + ' ' + parts[1]);
                        var match;
                        if((match = /^([0-9]+)([a-z]+)$/.exec(parts[2]))) {
                            var mult = ms_mult(match[2]);
                            _resolution = +match[1] * mult;
                        }
                    }
                });
                return {fields, xform};
            });
        },
        augment_group: function(anchor, group) {
            function arg_printer(name /* ... */) {
                var args = Array.prototype.slice.call(arguments, 1);
                return function() {
                    return name + '(' + args.map(JSON.stringify).join(',') + ')';
                };
            }
            return Object.assign({}, group, {
                dive: function(bins, depth) {
                    anchor.print = arg_printer('dive', bins, depth);
                    anchor.splitter = 'a';
                    return this;
                },
                // native interface
                mt_interval_sequence: function(start, binwid, len) { // ints
                    anchor.print = arg_printer('mt_interval_sequence', start, binwid, len);
                    anchor.splitter = 'r';
                    return this;
                },
                // somewhat nicer interface
                time: function(start, binwid, len) { // Date, ms, number
                    start = start ? start.getTime() : _start_time;
                    binwid = binwid || _resolution;
                    len = len || 10*365;
                    var startb = (start - _start_time)/_resolution,
                        widb = binwid/_resolution;
                    return this.mt_interval_sequence(startb, widb, len);
                },
                categorical: function() {
                    group.categorical();
                    return this.dive([], 1);
                }
            });
        }
    };
};

xfilter.fgb_queries = function() {
    return {
        do_query: function(query_url, filters, group) {
            var query = {
                filter: {},
                groupby: [group.dimension]
            };
            for(var f in filters) {
                if(group && group.dimension === f)
                    continue;
                if(filters[f].type !== 'set')
                    throw new Error("don't know how to handle filter type " + filters[f].type);
                query.filter[f] = filters[f].target;
            }
            return d3.json(query_url('query'), {
                method: 'POST',
                headers: {
                    "Content-type": "application/json; charset=UTF-8"
                },
                body: JSON.stringify(query)
            });
        },
        unpack_result: function(result) {
            return result.map(function(pair) {
                return {key: pair[0], value: pair[1]};
            });
        },
        fetch_schema: function(query_url) {
            return d3.text(query_url('')).then(function(s) {
                var i = s.indexOf(' ');
                var count = +s.slice(0, i),
                    columns = JSON.parse(s.slice(i+1).replace(/'/g, '"'));
                return {
                    fields: columns.reduce(function(p, v) {
                        p[v] = true;
                        return p;
                    }, {}),
                    xform: {}
                };
            });
        }
    };
};

// define our own filter handler to avoid the dreaded filterFunction
xfilter.filter_handler = function (dimension, filters) {
    if (filters.length === 0) {
        dimension.filter(null);
    } else if (filters.length === 1 && !filters[0].isFiltered) {
        // single value and not a function-based filter
        dimension.filterExact(filters[0]);
    } else if (filters.length === 1 && filters[0].filterType === 'RangedFilter') {
        // single range-based filter
        dimension.filterRange(filters[0]);
    } else {
        // this is the case changed from core dc.js
        // filterMultiple does not exist in crossfilter
        dimension.filterMultiple(filters);
    }
    return filters;
};


return xfilter;
}
    if (typeof define === 'function' && define.amd) {
        define([], _xfilter);
    } else if (typeof module == "object" && module.exports) {
        module.exports = _xfilter();
    } else {
        this.xfilter = _xfilter();
    }
}
)();

//# sourceMappingURL=xfilter.js.map