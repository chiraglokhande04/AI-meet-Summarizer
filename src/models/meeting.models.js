import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema({
  task: {
    type: String,
    required: true,
  },
  assignee: {
    type: String,
    default: "Team Member",
  },
  deadline: {
    type: String,
    default: "TBD",
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
});

const meetingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New Meeting",
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    duration: {
      type: String,
      default: "0 min",
    },
    transcript: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      default: "",
    },

    sentiment: {
      positive: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      negative: { type: Number, default: 0 },
    },

    actionItems: [actionItemSchema],

    audioSource: {
      type: String,

      default: "both",
    },
  },
  { timestamps: true }
);

const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
