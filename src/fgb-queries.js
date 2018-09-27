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
