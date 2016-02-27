'use strict'

const http = require('http');
const url = require('url');
const through = require('through2');
const httpUtil = require('../util/httpUtil');
const zlib = require('zlib');
const htmlUtil = require('../util/htmlUtil');

module.exports = class SpyProxy {
    constructor(options) {
        this.proxyServer = this.createProxyServer(options);
    }
    createProxyServer (options) {
        options = options || {};
        this.weinewPort = options.weinewPort;
        var port = options.port || 9888;
        var server = new http.Server();
        server.listen(port, () => {
            server.on('error', (e) => {
                // console.error(e);
            });
            server.on('request', (req, res) => {
                var urlObject = url.parse(req.url);
                var rOptions = {
                    protocol: urlObject.protocol,
                    hostname: urlObject.host,
                    method: req.method,
                    port: urlObject.port || 80,
                    path: urlObject.path
                    // auth
                }
                rOptions.headers = req.headers;
                var proxyReq = new http.ClientRequest(rOptions, (proxyRes) => {

                    var isGzip = httpUtil.isGzip(proxyRes);
                    var isHtml = httpUtil.isHtml(proxyRes);

                    Object.keys(proxyRes.headers).forEach(function(key) {
                        if(proxyRes.headers[key] != undefined){
                            var newkey = key.replace(/^[a-z]|-[a-z]/g, (match) => {
                                return match.toUpperCase()
                            });
                            var newkey = key;
                            if (isHtml && key === 'content-length') {
                                // do nothing
                            } else {
                                res.setHeader(newkey, proxyRes.headers[key]);
                            }
                        }
                    });

                    if (isHtml) {
                        if (isGzip) {
                            var _this = this;
                            proxyRes.pipe(new zlib.Gunzip()).pipe(through(function (chunk, enc, callback) {
                                var chunkString = chunk.toString();
                                console.log(_this.weinewPort);
                                var newChunkString = htmlUtil.injectScriptIntoHtml(chunkString,`<script src="http://192.168.1.102:${_this.weinewPort}/target/target-script-min.js#anonymous"></script>`);
                                console.log(newChunkString);
                                this.push(new Buffer(newChunkString));
                                // console.log(chunk.toString('utf-8'));
                                callback();
                            })).pipe(new zlib.Gzip()).pipe(res);
                        } else {
                            proxyRes.pipe(through(function (chunk, enc, callback) {
                                this.push(chunk);
                                // console.log(chunk.toString('utf-8'));
                                callback();
                            })).pipe(res);
                        }

                    } else {
                        proxyRes.pipe(res);
                    }


                });
                proxyReq.on('error', (e) => {
                    // console.error(e);
                })

                req.pipe(through(function (chunk, enc, callback) {
                    this.push(chunk);
                    // TODO:
                    // console.log(chunk.toString('utf-8'));
                    callback();
                })).pipe(proxyReq);

            });
        });

    }
}