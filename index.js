const express = require("express");
const cors = require("cors");
require("./config");
const {
  ComplaintSchema,
  UserSchema,
  AssignedComplaint,
  MessageSchema,
} = require("./Schema");
const app = express();
const PORT = 8000;

/**************************************** */
app.use(express.json());
app.use(cors({
   origin: 'http://localhost:3000', // Replace with your frontend's URL
   credentials: true, // Allow credentials (cookies, authorization headers, etc.)
}));
/********************************************** */
// Get all assigned complaints - Updated to include detailed complaint information
app.get("/assignedComplaints", async (req, res) => {
  try {
    const assignedComplaints = await AssignedComplaint.find();
    
    // Fetch full complaint details for each assigned complaint
    const detailedAssignedComplaints = await Promise.all(
      assignedComplaints.map(async (assigned) => {
        const complaintDetails = await ComplaintSchema.findById(assigned.complaintId);
        return {
          _id: assigned._id,
          agentId: assigned.agentId,
          complaintId: assigned.complaintId,
          status: assigned.status,
          agentName: assigned.agentName,
          complaintDetails: complaintDetails
        };
      })
    );
    
    res.json(detailedAssignedComplaints);
  } catch (error) {
    console.error("Error fetching assigned complaints:", error);
    res.status(500).json({ error: "Failed to retrieve assigned complaints" });
  }
});

// Assign a complaint to an agent - Updated to mark the original complaint as assigned
app.post("/assignedComplaints", async (req, res) => {
  try {
    const assignedComplaint = req.body;
    
    // First mark the original complaint as assigned
    await ComplaintSchema.findByIdAndUpdate(
      assignedComplaint.complaintId,
      { 
        assigned: true, 
        agentName: assignedComplaint.agentName 
      }
    );
    
    // Then create the assigned complaint record
    const result = await AssignedComplaint.create(assignedComplaint);
    
    res.status(201).json({ 
      message: "Complaint assigned successfully",
      assignedComplaint: result
    });
  } catch (error) {
    console.error("Error assigning complaint:", error);
    res.status(500).json({ error: "Failed to assign complaint" });
  }
});

// Update the status of a complaint - Make sure this updates both collections
app.put("/complaint/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;
    if (!complaintId || !status) {
      return res.status(400).json({ error: "Missing complaintId or status" });
    }

    // Update in the original complaints collection
    const updatedComplaint = await ComplaintSchema.findByIdAndUpdate(
      complaintId,
      { status },
      { new: true }
    );

    // Update in the assigned complaints collection
    const assigned = await AssignedComplaint.findOneAndUpdate(
      { complaintId: complaintId },
      { status },
      { new: true }
    );

    if (!updatedComplaint && !assigned) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    
    res.json({
      message: "Complaint status updated successfully",
      complaint: updatedComplaint
    });
  } catch (error) {
    console.error("Error updating complaint status:", error);
    res.status(500).json({ error: "Failed to update complaint status" });
  }
});

// Updated complaint status endpoint to include assigned status
app.get("/status", async (req, res) => {
  try {
    const complaints = await ComplaintSchema.find();
    res.json(complaints);
  } catch (error) {
    console.error("Error fetching complaints:", error);
    res.status(500).json({ error: "Failed to retrieve Complaints" });
  }
});
/******************message *******************************/
app.post("/messages", async (req, res) => {
  try {
    const { name, message, complaintId } = req.body;
    const messageData = new MessageSchema({
      name,
      message,
      complaintId,
    });
    const messageSaved = await messageData.save();
    res.status(200).json(messageSaved);
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get("/messages/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    const messages = await MessageSchema.find({ complaintId }).sort(
      "-createdAt"
    );
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
});

// New endpoint to check if email exists
app.post("/checkEmail", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    const existingUser = await UserSchema.findOne({ email });
    return res.json({ exists: !!existingUser });
  } catch (error) {
    console.error("Error checking email:", error);
    res.status(500).json({ error: "Failed to check email" });
  }
});

/***********for signup user************************************** */
app.post("/SignUp", async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user with this email already exists
    const existingUser = await UserSchema.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        message: "This email address is already registered",
        code: "EMAIL_EXISTS"
      });
    }
    
    // If email is unique, proceed with user creation
    const user = new UserSchema(req.body);
    const resultUser = await user.save();
    res.status(201).json(resultUser);
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Failed to create account", error: error.message });
  }
});

//////////////////////for login user///////////////////
app.post("/Login", async (req, res) => {
  const { email, password } = req.body;

  // Check if the credentials are for the admin
  if (email === "admin@gmail.com" && password === "admin") {
    return res.json({
      _id: "admin",
      name: "Admin",
      email: "admin@gmail.com",
      userType: "Admin",
    });
  }

  const user = await UserSchema.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "User doesn`t exist" });
  }
  if (user.email === email && user.password === password) {
    res.json(user);
  } else {
    res.status(401).json({ message: "Invalid Credentials" });
  }
});

//////////////////////////for fetching agent in admin portal///////////////
app.get("/AgentUsers", async (req, res) => {
  try {
    const { userType } = req.params;
    const users = await UserSchema.find({ userType: "Agent" });
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    } else {
      return res.status(200).json(users);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//////////////////////////for fetching ordinary user in admin portal///////////////
app.get("/OrdinaryUsers", async (req, res) => {
  try {
    const users = await UserSchema.find({ userType: "Ordinary" });
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    } else {
      return res.status(200).json(users);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//////////////////////////for fetching ordinary user in admin portal///////////////
app.get("/AgentUsers", async (req, res) => {
  try {
    // const { userType } = req.params;
    const agentUsers = await UserSchema.find({ userType: "Agent" });
    if (agentUsers.length === 0) {
      return res.status(404).json({ error: "User not found" });
    } else {
      return res.status(200).json(agentUsers);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//////////////////displaying agent with id/////////////////
app.get("/AgentUsers/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const user = await UserSchema.findOne({ _id: agentId });
    if (user.userType === "Agent") {
      return res.status(200).json(user);
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
////////////for deleting the user from admin portal////////////////
app.delete("/OrdinaryUsers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserSchema.findOne({ _id: id });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    } else {
      await UserSchema.deleteOne({ _id: id });
      await ComplaintSchema.deleteOne({ userId: id });
      return res.status(200).json({ message: "User deleted successfully" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

///////////////complaint register by user and its status checking///////////////
app.post("/Complaint/:id", async (req, res) => {
  const UserId = req.params.id;
  try {
    const user = await UserSchema.findById(UserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    } else {
      const complaint = new ComplaintSchema(req.body);
      let resultComplaint = await complaint.save();
      res.send(resultComplaint).status(200);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to register complaint" });
  }
});

/////////////////for the all complaints made by the single user/////////////
app.get("/status/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await UserSchema.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    } else {
      const comment = await ComplaintSchema.find({ userId: userId });
      res.json(comment);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve user" });
  }
});

/////////////status of complaint in admin page/////////////////////////////////////////
app.get("/status", async (req, res) => {
  try {
    const complaint = await ComplaintSchema.find();
    res.json(complaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve Complaints" });
  }
});

////////////Assigned complaint by admin//////////////////
app.post("/assignedComplaints", (req, res) => {
  try {
    const assignedComplaint = req.body;
    AssignedComplaint.create(assignedComplaint);
    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add assigned complaint" }); // Fixed syntax error
  }
});

////////////////complaints in agent homepage////////////////////
app.get("/allcomplaints/:agentId", async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const complaints = await AssignedComplaint.find({ agentId: agentId });

    // Fetch all complaintIds from the complaints
    const complaintIds = complaints.map((complaint) => complaint.complaintId);

    // Fetch the corresponding complaints with their names and cities
    const complaintDetails = await ComplaintSchema.find({
      _id: { $in: complaintIds },
    });

    // Merge the complaint details into the complaints array
    const updatedComplaints = complaints.map((complaint) => {
      const complaintDetail = complaintDetails.find(
        (detail) => detail._id.toString() === complaint.complaintId.toString()
      );
      return {
        ...complaint,
        name: complaintDetail.name,
        city: complaintDetail.city,
        state: complaintDetail.state,
        address: complaintDetail.address,
        pincode: complaintDetail.pincode,
        comment: complaintDetail.comment,
        department: complaintDetail.department, 
        taluk: complaintDetail.taluk, // Add this line
        wardNo: complaintDetail.wardNo, // Add this line
      };
    });
    res.json(updatedComplaints);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to get complaints" });
  }
});

////////////////////updating the user profile by admin/////////////////////////////

app.put("/user/:_id", async (req, res) => {
  try {
    const { _id } = req.params;
    const { name, email, phone, department } = req.body; // Add department field
    
    // Check if updating to an email that already exists (excluding the current user)
    if (email) {
      const existingUser = await UserSchema.findOne({ email, _id: { $ne: _id } });
      if (existingUser) {
        return res.status(409).json({ 
          message: "This email address is already registered by another user",
          code: "EMAIL_EXISTS"
        });
      }
    }
    
    const user = await UserSchema.findByIdAndUpdate(
      _id,
      { name, email, phone, department }, // Add department field
      { new: true }
    );
    if (!user) {
      res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update the user" });
  }
});

////////////////updating the complaint from the agent/////////////////////////////
app.put("/complaint/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;
    if (!complaintId || !status) {
      return res.status(400).json({ error: "Missing complaintId or status" });
    }

    const updatedComplaint = await ComplaintSchema.findByIdAndUpdate(
      complaintId,
      { status },
      { new: true }
    );

    const assigned = await AssignedComplaint.findOneAndUpdate(
      { complaintId: complaintId },
      { status },
      { new: true }
    );

    if (!updatedComplaint && !assigned) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    res.json(updatedComplaint);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

app.listen(PORT, () => console.log(`server started at ${PORT}`));

// Update only the relevant routes for complaint status management

// Update the status of a complaint with additional tracking information
app.put("/complaint/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, updateTime } = req.body;
    
    if (!complaintId || !status) {
      return res.status(400).json({ error: "Missing complaintId or status" });
    }

    // Update in the original complaints collection with completion time
    const updatedComplaint = await ComplaintSchema.findByIdAndUpdate(
      complaintId,
      { 
        status,
        ...(updateTime && { completionTime: updateTime }),
      },
      { new: true }
    );

    // Update in the assigned complaints collection
    const assigned = await AssignedComplaint.findOneAndUpdate(
      { complaintId: complaintId },
      { 
        status,
        ...(updateTime && { completionTime: updateTime }),
      },
      { new: true }
    );

    if (!updatedComplaint && !assigned) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    
    res.json({
      message: "Complaint status updated successfully",
      complaint: updatedComplaint
    });
  } catch (error) {
    console.error("Error updating complaint status:", error);
    res.status(500).json({ error: "Failed to update complaint status" });
  }
});

// Enhanced route to get all complaints for an agent with better sorting and details
app.get("/allcomplaints/:agentId", async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const complaints = await AssignedComplaint.find({ agentId: agentId });

    // Fetch all complaintIds from the complaints
    const complaintIds = complaints.map((complaint) => complaint.complaintId);

    // Fetch the corresponding complaints with their names and cities
    const complaintDetails = await ComplaintSchema.find({
      _id: { $in: complaintIds },
    });

    // Merge the complaint details into the complaints array
    const updatedComplaints = complaints.map((complaint) => {
      const complaintDetail = complaintDetails.find(
        (detail) => detail._id.toString() === complaint.complaintId.toString()
      );
      
      // Make sure we have valid complaint details before accessing properties
      if (!complaintDetail) {
        return null; // Skip this complaint if no details found
      }
      
      return {
        ...complaint,
        name: complaintDetail.name,
        city: complaintDetail.city,
        state: complaintDetail.state,
        address: complaintDetail.address,
        pincode: complaintDetail.pincode,
        comment: complaintDetail.comment,
        department: complaintDetail.department, 
        taluk: complaintDetail.taluk,
        wardNo: complaintDetail.wardNo,
        completionTime: complaintDetail.completionTime || null,
      };
    }).filter(complaint => complaint !== null); // Filter out any null entries
    
    // Sort complaints - pending first, then by most recent
    updatedComplaints.sort((a, b) => {
      // Sort by status first (pending before completed)
      if (a._doc.status !== 'completed' && b._doc.status === 'completed') return -1;
      if (a._doc.status === 'completed' && b._doc.status !== 'completed') return 1;
      
      // If same status, sort by timestamp (newest first)
      const aTime = a._doc.completionTime ? new Date(a._doc.completionTime) : new Date(0);
      const bTime = b._doc.completionTime ? new Date(b._doc.completionTime) : new Date(0);
      
      return bTime - aTime;
    });
    
    res.json(updatedComplaints);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to get complaints" });
  }
});


app.delete("/agentUsers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserSchema.findOne({ _id: id, userType: "Agent" });
    
    if (!user) {
      return res.status(404).json({ error: "Agent not found" });
    } else {
      // Delete the agent
      await UserSchema.deleteOne({ _id: id });
      
      // Also delete any assigned complaints related to this agent
      await AssignedComplaint.deleteMany({ agentId: id });
      
      return res.status(200).json({ message: "Agent deleted successfully" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});