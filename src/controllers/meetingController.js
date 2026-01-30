import Meeting from "../models/meeting.models.js";

export const saveMeeting = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      title,
      transcript,
      summary,
      actionItems,
      sentiment,
      duration,
      audioSource,
    } = req.body;

    const newMeeting = new Meeting({
      user: userId,
      title: title || "New Meeting",
      transcript,
      summary,
      actionItems,
      sentiment,
      duration,
      audioSource,
    });

    const savedMeeting = await newMeeting.save();
    res.status(201).json(savedMeeting);
  } catch (error) {
    console.error("Error saving meeting:", error);
    res.status(500).json({ error: "Failed to save meeting" });
  }
};

export const getUserMeetings = async (req, res) => {
  try {
    const userId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const meetings = await Meeting.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Meeting.countDocuments({ user: userId });

    res.status(200).json({
      meetings,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalMeetings: total,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
};

export const getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findById(id);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this meeting" });
    }

    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch meeting" });
  }
};
