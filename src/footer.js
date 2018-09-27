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
