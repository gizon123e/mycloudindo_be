const Address = require("../../models/model-address");
const Sekolah = require("../../models/model-sekolah");
const SimulasiSekolah = require('../../models/model-simulasi-sekolah')
const Konsumen = require("../../models/konsumen/model-konsumen");

const path = require("path")
const dotenv = require('dotenv');
dotenv.config()

module.exports = {
    getAllSekolah: async (req, res, next) => {
        try {
            const data = await Sekolah.find({ detailId: req.params.id }).populate('address')

            return res.status(200).json({
                message: "get data all success",
                data
            })
        } catch (error) {
            console.log(error);
            next(error)
        }
    },

    getByNPSNSekolahSimulasi: async (req, res, next) => {
        try {
            const data = await SimulasiSekolah.findOne({ NPSN: req.params.id })
            if (!data) return res.status(404).json({ message: "NPSN yang kamu masukan tidak terdaftar di Kemendiknas" })

            const datas = await Sekolah.findOne({ NPSN: req.params.id })
            if (datas) return res.status(400).json({ message: "NPSN sudah terdaftar" })

            return res.status(200).json({
                message: "get data all success",
                data
            })
        } catch (error) {
            console.log(error);
            next(error)
        }
    },

    createSekolah: async (req, res, next) => {
        try {
            const {
                province,
                regency,
                district,
                village,
                code_pos,
                address_description,
                long_pin_alamat,
                lat_pin_alamat,
                addressId,
                NPSN,
                namaSekolah
            } = req.body
            const files = req.files
            const logoSekolah = files ? files.logoSekolah : null;

            if (!logoSekolah) {
                return res.status(400).json({ message: "kamu gagal masukan file logoSekolah" });
            }

            const imageName = `${Date.now()}${path.extname(logoSekolah.name)}`;
            const imagePath = path.join(__dirname, '../../public/profil-sekolah', imageName);

            await logoSekolah.mv(imagePath);
            const numberNPSN = parseInt(NPSN)

            let alamat
            if (province && regency && district && village && code_pos && address_description && long_pin_alamat && lat_pin_alamat) {
                alamat = await Address.create({
                    province,
                    regency,
                    district,
                    village,
                    code_pos,
                    address_description,
                    pinAlamat: {
                        long: long_pin_alamat,
                        lat: lat_pin_alamat
                    },
                    userId: req.user.id
                });
            }

            const dataKemendiknas = await SimulasiSekolah.findOne({ NPSN: numberNPSN })
            if (!dataKemendiknas) return res.status(404).json({ message: "data NPSN tidak terdaftar di Kemendikes" })

            const validateNpsn = await Sekolah.findOne({ NPSN: numberNPSN })
            if (validateNpsn) return res.status(400).json({ message: "data NPSN sudah terdaftar di Super Apps" })

            const kelas = []
            for (let data of dataKemendiknas.kelas) {
                kelas.push({
                    namaKelas: data.namaKelas,
                    jumlahMuridKelas: data.jumlahMuridKelas
                })
            }

            const dataKonsumen = await Konsumen.findOne({ userId: req.user.id })

            let sekolah
            if (alamat) {
                sekolah = await Sekolah.create({
                    userId: req.user.id,
                    detailId: dataKonsumen._id,
                    address: alamat._id,
                    NPSN: numberNPSN,
                    jumlahMurid: dataKemendiknas.jumlahMurid,
                    jenisPendidikan: dataKemendiknas.jenisPendidikan,
                    statusSekolah: dataKemendiknas.statusSekolah,
                    jenjangPendidikan: dataKemendiknas.jenjangPendidikan,
                    satuanPendidikan: dataKemendiknas.satuanPendidikan,
                    kelas,
                    logoSekolah: `${process.env.HOST}public/profil-sekolah/${imageName}`,
                    namaSekolah
                });
            } else if (addressId) {
                sekolah = await Sekolah.create({
                    userId: req.user.id,
                    detailId: dataKonsumen._id,
                    address: addressId,
                    NPSN: numberNPSN,
                    jumlahMurid: dataKemendiknas.jumlahMurid,
                    jenisPendidikan: dataKemendiknas.jenisPendidikan,
                    statusSekolah: dataKemendiknas.statusSekolah,
                    jenjangPendidikan: dataKemendiknas.jenjangPendidikan,
                    satuanPendidikan: dataKemendiknas.satuanPendidikan,
                    kelas,
                    logoSekolah: `${process.env.HOST}public/profil-sekolah/${imageName}`,
                    namaSekolah
                });
            }

            if (!sekolah) return res.status(400).json({ message: "kamu gagal masukin data sekolah" })

            return res.status(201).json({ message: "Berhasil Menambahkan Sekolah", data: sekolah })
        } catch (error) {
            console.log(error);
            next(error)
        }
    }
}