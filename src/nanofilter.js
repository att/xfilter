function nanofilter(server, port, k) {
    var _schema, _filters = {}, _data;
    function do_query(q, k) {
        d3.json('http://' + server + ':' + port + '/' + q, k);
    }

    function build_query() {
        var parts = ['count'];
        for(var f in _filters) {
            var filter;
            switch(_filters[f].type) {
            case 'set':
                filter = 'set(' + _filters[f].target.join(',') + ')';
                break;
            case 'interval':
                filter = 'interval(' + _filters[f].target.join(',') + ')';
                break;
            }
            parts.push('.a("' + f + '",' + filter + ')');
        }
        return parts.join('');
    }

    var nf = {};

    nf.dimension = function(field) {
        return {
            filter: function(v) {
                if(v !== null)
                    throw new Error('unexpected non-null filter()');
                delete _filters[field];
            },
            filterExact: function(val) {
                _filters[field] = {type: 'set', target: [val]};
            },
            filterRange: function(range) {
                _filters[field] = {type: 'interval', target: range};
            },
            filterFunction: function() {
                throw new Error('filter functions not allowed');
            },
            group: function() {
                return {
                    all: function() {
                        return _data[field];
                    }
                };
            }
        };
    };

    nf.commit = function(k) {
        do_query(build_query(), function(error, result) {
            if(!error)
                _data = result;
            k(error, result);
        });
    };

    do_query('schema', function(error, schema) {
        if(error)
            k(error, schema);
        else {
            _schema = schema;
            k(error, schema);
        }
    });

    return nf;
}
