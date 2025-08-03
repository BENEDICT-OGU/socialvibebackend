function getHotScore(post) {
    const now = new Date();
    const ageInHours = (now - new Date(post.createdAt)) / 1000 / 3600;
  
    const engagement = (post.likes || 0) * 2 + 
                       (post.comments || 0) * 3 + 
                       (post.shares || 0) * 5;
  
    return engagement / Math.pow(ageInHours + 2, 1.5);
  }
  
  module.exports = { getHotScore };
  