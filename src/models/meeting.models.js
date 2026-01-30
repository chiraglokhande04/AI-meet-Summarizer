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

const topicSchema = new mongoose.Schema({
  topic: String,
  discussion: String,
});

const minutesOfMeetingSchema = new mongoose.Schema({
  attendees: [String],
  topicsDiscussed: [topicSchema],
  decisions: [String],
  openQuestions: [String],
});


const meetingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, default: "New Meeting" },

    date: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },

    startTime: { type: Date, default: Date.now },

    duration: { type: String, default: "0 min" },

    transcript: { type: String, default: "" },

    executiveSummary: { type: String, default: "" },

    detailedSummary: { type: String, default: "" },

    minutesOfMeeting: minutesOfMeetingSchema,

    sentiment: {
      positive: Number,
      neutral: Number,
      negative: Number,
    },

    actionItems: [actionItemSchema],

    audioSource: { type: String, default: "both" },
  },
  { timestamps: true }
);


const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
