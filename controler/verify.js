const User = require("../models/model-auth-user");
const bcrypt = require("bcrypt");

module.exports = {
    verifyOtpRegister: async (req, res, next) =>{
        try {
            const { kode_otp, id } = req.body;
            const user = await User.findById(id);
            if(!user) return res.status(400).json({message:"User tidak ditemukan"});
            if(user.verifkasi) return res.status(400).json({message: "User sudah terverifikasi"});
            if(new Date().getTime() > user.codeOtp.expire.getTime() ) return res.status(401).json({message: "Kode sudah tidak valid"});
            const kode = await bcrypt.compare(kode_otp.toString(), user.codeOtp.code);
            if(!kode) return res.status(401).json({message: "Kode OTP Tidak Sesuai"});
            await User.findByIdAndUpdate(id, {verifikasi: true});
            return res.status(200).json({message: "Verifikasi Berhasil"});
        } catch (error) {
            console.log(error);
            next(error)
        }
    },
    verifyOtpLogin: async (req, res, next ) =>{
        try {
            const { kode_otp, id } = req.body;
            const user = await User.findById(id);
            if(!user) return res.status(400).json({message:"User tidak ditemukan"});
            if(user.verifkasi) return res.status(400).json({message: "User sudah terverifikasi"});
            if(new Date().getTime() > user.codeOtp.expire.getTime() ) return res.status(401).json({message: "Kode sudah tidak valid"});
            const kode = await bcrypt.compare(kode_otp.toString(), user.codeOtp.code);
            if(!kode) return res.status(401).json({message: "Kode OTP Tidak Sesuai"});
            await User.findByIdAndUpdate(id, {verifikasi: true});
            return res.status(200).json({message: "Verifikasi Berhasil"});
        } catch (error) {
            console.log(error);
            next(error)
        }
    }
}