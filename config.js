{

  "host": "0.0.0.0",
  "port": 7777,

  "keyLength": 8,

  "maxLength": 400000,

  "staticMaxAge": 86400,

  "recompressStaticAssets": true,

  "logging": [
    {
      "level": "verbose",
      "type": "Console",
      "colorize": true
    }
  ],

  "keyGenerator": {
    "type": "betterrand"
  },

  "storage": {
    "type": "redis",
    "host": "localhost",
    "port": 6379,
    "db": 1
  },

  "documents": {
    "about": "./about.md"
  }

}

