# Arbitrary backend - crossfilter bridge

This library implements enough of the crossfilter API and an asynchronous commit hook
so that (in theory) any query engine can be connected to dc.js

Currently the query engine supported is Nanocubes (this library was originally called "nanofilter");
use `xf.engine(xfilter.nanocube_queries)` to connect with a Nanocubes server
([demo](http://att.github.io/xfilter/chicago-crimes-nanocube.html?server=http://nanocubes.net/nanocube/20)).

The intent is that this library can be generalized to support any query engine. Another example
engine should be available shortly.

