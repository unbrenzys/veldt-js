(function() {

    'use strict';

    var checkField = function(meta, field) {
        if (meta) {
            if (meta.type !== 'string') {
                throw 'Field `' + field + '` is not `string` in meta data.';
            }
        }
        throw 'Field `' + field + '` is not recognized in meta data.';
    };

    module.exports = function(meta, query) {
        if (!query.field) {
            throw 'QueryString `field` is missing from argument.';
        }
        if (!query.string) {
            throw 'QueryString `string` is missing from argument.';
        }
        checkField(meta[query.field], query.field);
    };

}());
