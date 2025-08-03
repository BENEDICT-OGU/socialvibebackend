function calculateEngagementRate(likes, comments, shares, followers) {
    const total = likes + comments + shares;
    return followers === 0 ? 0 : (total / followers) * 100;
  }
  
  module.exports = { calculateEngagementRate };
  