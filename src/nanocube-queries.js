function nanocube_queries() {
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
        build_query: function(filters, group) {
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
            return parts.join('');
        },
        fetch_schema: function(do_query) {
            return do_query('schema').then(function(schema) {
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
                return {schema, fields, xform};
            });
        },
        augment_group: function(anchor, group) {
            function arg_printer(name /* ... */) {
                var args = Array.prototype.slice.call(arguments, 1);
                return function() {
                    return name + '(' + args.map(JSON.stringify).join(',') + ')';
                };
            }
            return Object.assign(group, {
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
                    this.mt_interval_sequence(startb, widb, len);
                    return this;
                }
            });
        }
    };
}
