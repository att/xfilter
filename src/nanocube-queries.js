xfilter.nanocube_queries = function(version = 3) {
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
            if(group.state)
                parts.push('.' + group.state.splitter + '("' + group.dimension + '",' + group.state.print() + ')');
            return d3.json(query_url(parts.join('')));
        },
        unpack_result: function(result) {
            return result.root.children.map(function(pv) {
                return {key: pv.path[0], value: pv.val};
            });
        },
        fetch_schema: function(query_url) {
            return d3.json(query_url(version === 4 ? 'schema()' : 'schema')).then(function(schema) {
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
                            fro: function(v, state) {
                                return new Date(state.start*_resolution + _start_time + v * state.binwid*_resolution);
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
            function dive_state(bins, depth) {
                return {
                    bins: bins,
                    depth: depth,
                    splitter: 'a',
                    print: arg_printer('dive', bins, depth)
                };
            }
            function time_state(start, binwid, len) {
                return {
                    start: start,
                    binwid: binwid,
                    len: len,
                    splitter: 'r',
                    print: arg_printer('mt_interval_sequence', start, binwid, len)
                };
            }
            return Object.assign({}, group, {
                dive: function(bins, depth) {
                    anchor.state = dive_state(bins, depth);
                    return this;
                },
                // native interface
                mt_interval_sequence: function(start, binwid, len) { // ints
                    anchor.state = time_state(start, binwid, len);
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
