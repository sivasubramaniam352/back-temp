const User = require('../models/user.model');
const Role = require('../models/Role');

exports.createRole = async (req, res) => {
    const user = req.user;  //token authentication user
    const Req = req.body;
    try {
        const docs = await User.findOne({ _id: user._id }).populate('role');
        if (docs) {
            if (docs.admin === true || docs.role.role.write.includes("MANAGEMENT")) {
                const data = await Role.findOne({ 'role.name': Req.name,userId:user._id });
                if (!data) {
                    let role = new Role({
                        userId: user._id,
                        role: {
                            name: Req.name
                        }
                    });
                    const roleData = await role.save();
                    if (roleData) {
                        return res.status(200).json({ success: true, message: 'role create successfully', Role: roleData });
                    }
                    else {
                        return res.status(500).json({ success: false, error: 'Failed to Role create' });
                    }
                }
                else {
                    return res.status(500).json({ success:false, error: 'Roles already added ' });
                }
            }
            else {
                return res.status(500).json({ success: false, error: 'You are not an admin' });
            }
        }
        else {
            return res.status(500).json({ success: false, error: 'cannot not get your data' });
        }
    } catch (err) {
        return res.status(400).json({ error: err, message: "something wrong to find your account" });
    }
}
exports.addUserRole = async (req, res) => {
    const user = req.user;  //token authentication user
    const Req = req.body;
    try {
        const docs = await User.findOne({ _id: user._id }).populate('role');
        if (docs) {
            if (docs.admin === true || docs.role.role.write.includes("MANAGEMENT")) {
                const data = await Role.findOne({ 'role.name': Req.name,userId:user._id  });
                if (data) {
                    if (Req.read.length !== 0 && Req.write.length !== 0) {
                        const roleData = await Role.updateOne({ _id: data._id }, { $set: { 'role.write':Req.write,'role.read':Req.read } });
                        if (roleData) {
                            return res.status(200).json({ success: true, message: 'role access added  successfully', Role: roleData });
                        }
                        else {
                            return res.status(500).json({ success: false, error: 'Failed to Role create' });
                        }
                    }
                    else {
                        return res.status(500).json({ success: false, error: 'Roles read and write is empty ' });
                    }
                }
                else {
                    return res.status(500).json({ success: false, error: 'cannot get role here' });
                }
            }
            else {
                return res.status(500).json({ success: false, error: 'You are not an admin' });
            }
        }
        else {
            return res.status(500).json({ success: false, error: 'cannot not get your data' });
        }
    } catch (err) {
        return res.status(400).json({ error: err, message: "something wrong to find your account" });
    }
}
exports.getRoleAll = async (req, res) => {
    const currentUser = req.user;
    try {
        const user = await User.findOne({ _id: currentUser._id }).populate('role');
        if (user) {
            if (user.admin === true || user.role.role.write.includes("MANAGEMENT")) {
                try {
                    const role = await Role.find({ userId: currentUser._id }
                        //,{_id:0,'role.write':0,'role.read':0}
                        );
                    if (role) {
                        return res.status(200).json({ success: true, message: "gotted successfully", data: role });
                    }
                    else {
                        return res.status(500).json({ success: false, message: "User role data unavailable" });
                    }
                }
                catch (err) {
                    return res.status(500).json({ success: false, message: "User role data not found", data: err })
                }
            }
            else {
                return res.status(500).json({ success: false, message: "You are not an admin" })
            }
        } else {
            return res.status(500).json({ success: false, message: "Not found" });
        }
    }
    catch (err) {
        return res.status(400).json({ success: false, message: "We not found your data", data: err })
    }
}
exports.getOne = async (req, res) => {
    const currentUser = req.user;
    const name = req.params.name;
    try {
        const user = await User.findOne({ _id: currentUser._id }).populate('role');
        if (user) {
            if (user.admin === true || docs.role.role.write.includes("MANAGEMENT")) {
                try {
                    const role = await Role.findOne({ 'role.name': name });
                    if (role) {
                        return res.status(200).json({ success: true, message: "gotted successfully", data: role });
                    }
                    else {
                        return res.status(500).json({ success: false, message: "User role data unavailable" });
                    }
                }
                catch (err) {
                    return res.status(500).json({ success: false, message: "User role data not found", data: err })
                }
            }
            else {
                return res.status(500).json({ success: false, message: "admin able see this" })
            }
        }
        else {
            return res.status(500).json({ success: false, message: "Your data unavailable" })
        }
    }
    catch (err) {
        return res.status(400).json({ success: false, message: "We not found your data", data: err })
    }
}


exports.getRole = async (req, res) => {
    const currentUser = req.user;
    const role = req.params.id;
    try {
        const user = await User.findOne({ _id: currentUser._id });
        if (user) {
            const userAccess = await Role.findOne({ _id: role });
            if (userAccess) {
                return res.status(200).json({ message: 'Got successfuly!', data: userAccess ,success:true});
            }
        }
        else return res.status(404).json({message:'You are not user',success:false});
    } catch (e) {
        return res.status(404).json(e)
    }
}