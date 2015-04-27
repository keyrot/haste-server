{
  "host": "0.0.0.0",
  "port": 7777,
  "keyLength": 10,
  "maxLength": 5000000,
  "staticMaxAge": 86400,
  "recompressStaticAssets": false,
  "logging": [
    {
      "level": "verbose",
      "type": "Console",
      "colorize": true
    }
  ],
  "keyGenerator": {
    "type": "keygen"
  },
  "storage": {
    "type": "redis"
  },
  "documents": {
  }
}
