const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  inputText: {
    type: String,
    required: true
  },
  summaryResult: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  emoji: {
    type: String,
    default: '📄'
  },
  tags: {
    type: [String],
    default: []
  },
  chatHistory: {
    type: [{
      role: String,
      content: String
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  }
});

// Index composto para queries eficientes de histórico
summarySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Summary', summarySchema);
