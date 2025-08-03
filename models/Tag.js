const tagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
}, { timestamps: true });

// Virtual for postCount (instead of storing it)
tagSchema.virtual('postCount').get(function() {
  return this.posts.length;
});

export default mongoose.models.Tag || mongoose.model('Tag', tagSchema);