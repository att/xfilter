function nanofilter(server, port) {
    var _schema, _filters = {};
    function do_query(q, k) {
        d3.json('http://' + server + ':' + port + '/' + q, k);
    }

    do_query('schema', function(schema) {
        _schema = schema;
    });


    var nf = {};

    nf.dimension = function(field) {
        return {
            filter: function(v) {
                if(v !== null)
                    throw new Error('unexpected non-null filter()');
                delete _filters[field];
            },
            filterExact: function(val) {
                _filters[field] = {type: 'set', target: [v]};
            },
            filterRange: function(range) {
                _filters[field] = {type: 'interval', target: range};
            },
            filterFunction() {
                throw new Error('filter functions not allowed');
            },
            group: function() {
                
            }
        };
    };

    return nf;
}
