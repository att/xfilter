function nanocube_queries() {
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
        }
    };
}
