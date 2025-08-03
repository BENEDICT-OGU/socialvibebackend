function extractHashtags(text) {
    return (text.match(/#\w+/g) || []).map(tag => tag.toLowerCase());
  }
  
  module.exports = { extractHashtags };
  