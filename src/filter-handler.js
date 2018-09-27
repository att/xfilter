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

