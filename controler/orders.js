const Orders = require("../models/pesanan/model-orders")
const Product = require('../models/model-product');
const axios = require("axios")
const DetailPesanan = require('../models/model-detail-pesanan');
const VaUser = require("../models/model-user-va");
const VA = require("../models/model-virtual-account")
const VA_Used = require("../models/model-va-used");
const { Transaksi, Transaksi2 } = require("../models/model-transaksi")
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const TokoVendor = require('../models/vendor/model-toko');
const User = require("../models/model-auth-user");
const Pengiriman = require("../models/model-pengiriman");
const Invoice = require("../models/model-invoice");
const VirtualAccount = require("../models/model-virtual-account");
const Ewallet = require("../models/model-ewallet");
const GeraiRetail = require("../models/model-gerai");
const Fintech = require("../models/model-fintech");
const Pembatalan = require("../models/model-pembatalan");
const Pesanan = require("../models/pesanan/model-orders");
const VirtualAccountUser = require("../models/model-user-va");
const Sekolah = require("../models/model-sekolah");
const DataProductOrder = require("../models/pesanan/model-data-product-order");

dotenv.config();

const now = new Date();
now.setHours(0, 0, 0, 0);
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);
const today = new Date();
const dd = String(today.getDate()).padStart(2, '0');
const mm = String(today.getMonth() + 1).padStart(2, '0');
const yyyy = today.getFullYear();

const hh = String(today.getHours()).padStart(2, '0');
const mn = String(today.getMinutes()).padStart(2, '0');
const ss = String(today.getSeconds()).padStart(2, '0');
const date = `${yyyy}${mm}${dd}`;
const minutes = `${hh}${mn}${ss}`;

module.exports = {
    getOrderPanel: async (req, res, next) => {
        try {
            const datas = await Orders.find()
                .populate({
                    path: 'product.productId',
                    populate: {
                        path: 'categoryId',
                    },
                    populate: {
                        path: 'userId',
                        select: '-password'
                    },
                })
                .populate('userId', '-password').populate('addressId')

            res.status(200).json({
                message: "Success get data orders",
                datas
            });
        } catch (error) {
            console.log(error)
            if (error && error.name === 'ValidationError') {
                return res.status(400).json({
                    error: true,
                    message: error.message,
                    fields: error.fields
                })
            }
            next(error)
        }
    },

    getOrders: async (req, res, next) => {
        try {
            const { status } = req.query
            let dataOrders;
            if (req.user.role === 'konsumen') {
                const filter = {
                    userId: new mongoose.Types.ObjectId(req.user.id),
                }
                const dataOrders = await Orders.aggregate([
                    { $match: filter },
                    { $project: { items: 1, status: 1, createdAt: 1, expire: 1, biaya_layanan: 1, biaya_jasa_aplikasi: 1 } },
                    {
                        $lookup: {
                            from: 'detailpesanans',
                            let: { orderId: '$_id' },
                            pipeline: [
                                { $match: { $expr: { $eq: ['$id_pesanan', '$$orderId'] } } },
                                { $project: { _id: 1, total_price: 1 } }
                            ],
                            as: 'detail_pesanan'
                        }
                    },
                    { $unwind: "$detail_pesanan" },
                    { $addFields: { total_pesanan: "$detail_pesanan.total_price" } },
                    { $unwind: "$items" },
                    { $unwind: "$items.product" },
                    {
                        $lookup: {
                            from: 'products',
                            let: { productIds: '$items.product.productId' },
                            pipeline: [
                                { $match: { $expr: { $eq: ['$_id', '$$productIds'] } } },
                                { $project: { _id: 1, name_product: 1, image_product: 1, categoryId: 1, userId: 1, total_price: 1 } }
                            ],
                            as: 'productInfo'
                        }
                    },
                    { $unwind: "$productInfo" },
                    { $addFields: { 'items.product.productId': "$productInfo" } },
                    {
                        $lookup: {
                            from: "users",
                            let: { userId: { $toObjectId: "$items.product.productId.userId" } },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                                { $project: { _id: 1, role: 1 } }
                            ],
                            as: "user_details"
                        }
                    },
                    { $unwind: "$user_details" },
                    { $addFields: { 'items.product.productId.userId': "$user_details" } },
                    {
                        $lookup: {
                            from: "specificcategories",
                            localField: "items.product.productId.categoryId",
                            foreignField: "_id",
                            as: "category_details"
                        }
                    },
                    { $unwind: "$category_details" },
                    { $addFields: { 'items.product.productId.categoryId': "$category_details" } },
                    { $project: { productInfo: 0, category_details: 0 } },
                    {
                        $group: {
                            _id: "$_id",
                            items: {
                                $push: {
                                    product: "$items.product",
                                    deadline: "$items.deadline",
                                    kode_pesanan: "$items.kode_pesanan"
                                }
                            },
                            status: { $first: "$status" },
                            expire: { $first: "$expire" },
                            createdAt: { $first: "$createdAt" },
                            total_pesanan: { $first: "$total_pesanan" },
                            biaya_layanan: { $first: "$biaya_layanan" },
                            biaya_jasa_aplikasi: { $first: "$biaya_jasa_aplikasi" },
                        }
                    },
                    {
                        $sort: {
                            createdAt: -1
                        }
                    }
                ])
                // return res.status(200).json({ message: 'get data all Order success', data: dataOrders })

                if (!dataOrders || dataOrders.length < 1) {
                    return res.status(200).json({ message: `anda belom memiliki ${req.user.role === "konsumen" ? "order" : "orderan"}` })
                }

                let data = []
                let jumlah_uang = 0
                for (const order of dataOrders) {
                    let { items, status, total_pesanan , ...rest } = order
                    let detailBerlangsung;
                    const transaksi = await Transaksi.exists({id_pesanan: order._id, subsidi: false})
                    const transaksiSubsidi = await Transaksi.exists({id_pesanan: order._id, subsidi: true})
                    if (order.status === "Belum Bayar" || order.status === "Dibatalkan") {
                        if(transaksi && transaksiSubsidi){
                            if( transaksiSubsidi ){
                                jumlah_uang += order.biaya_layanan + order.biaya_jasa_aplikasi
                                const dataProduct = await DataProductOrder.findOne({pesananId: order._id, transaksiId: transaksiSubsidi._id})
                                const invoice = await Invoice.findOne({id_transaksi: transaksiSubsidi._id});
                                const pengiriman = await Pengiriman.findOne({
                                    invoice: invoice._id
                                }).lean()
                                const store = {}
                                for (const item of order.items) {
                                    const storeId = item.product.productId.userId._id.toString()

                                    let detailToko;

                                    switch (item.product.productId.userId.role) {
                                        case "vendor":
                                            detailToko = await TokoVendor.findOne({ userId: storeId }).select('namaToko');
                                            break;
                                        case "supplier":
                                            detailToko = await Supplier.findOne({ userId: storeId });
                                            break;
                                        case "produsen":
                                            detailToko = await Produsen.findOne({ userId: storeId });
                                            break;
                                    }
                                    
                                    const productSelected = dataProduct.dataProduct.find(prod => { return prod._id.toString() === item.product.productId._id })
                                    const totalQuantity = pengiriman.productToDelivers.reduce((accumulator, currentValue) => {
                                        return accumulator + currentValue.quantity;
                                    }, 0);
                                    detailBerlangsung = pengiriman ? pengiriman.status_pengiriman : null
                                    jumlah_uang += productSelected.total_price * totalQuantity + pengiriman.total_ongkir
                                    if (!store[storeId]) {
                                        store[storeId] = {
                                            total_pesanan: jumlah_uang,
                                            seller: {
                                                _id: item.product.productId.userId._id,
                                                idToko: detailToko._id,
                                                namaToko: detailToko.namaToko
                                            },
                                            status_pengiriman: [pengiriman],
                                            arrayProduct: []
                                        }
                                    }
                                    const { productId, quantity , ...restOfProduct } = item.product
                                    store[storeId].arrayProduct.push({ productId: productSelected, ...restOfProduct, quantity: totalQuantity , detailBerlangsung })
                                    jumlah_uang = 0
                                }
                                Object.keys(store).forEach(key => {
                                    data.push({ ...rest , status: "Berlangsung", ...store[key], dibatalkanOleh: null })
                                })
                            }

                            if(transaksi){
                                jumlah_uang += order.biaya_layanan + order.biaya_jasa_aplikasi
                                const store = {}
                                const invoice = await Invoice.findOne({id_transaksi: transaksi._id})
                                for (const item of order.items) {
                                    const storeId = item.product.productId.userId._id.toString()

                                    let detailToko;

                                    switch (item.product.productId.userId.role) {
                                        case "vendor":
                                            detailToko = await TokoVendor.findOne({ userId: storeId }).select('namaToko');
                                            break;
                                        case "supplier":
                                            detailToko = await Supplier.findOne({ userId: storeId });
                                            break;
                                        case "produsen":
                                            detailToko = await Produsen.findOne({ userId: storeId });
                                            break;
                                    }
                                    const pengiriman = await Pengiriman.findOne({
                                        orderId: order._id, 
                                        invoice: invoice._id
                                    }).lean()
                                    const totalQuantity = pengiriman.productToDelivers.reduce((accumulator, currentValue) => {
                                        return accumulator + currentValue.quantity;
                                    }, 0);
                                    detailBerlangsung = pengiriman ? pengiriman.status_pengiriman : null
                                    jumlah_uang += item.product.productId.total_price * totalQuantity + pengiriman.total_ongkir
                                    if (!store[storeId]) {
                                        store[storeId] = {
                                            total_pesanan: jumlah_uang,
                                            seller: {
                                                _id: item.product.productId.userId._id,
                                                idToko: detailToko._id,
                                                namaToko: detailToko.namaToko
                                            },
                                            status_pengiriman: [pengiriman],
                                            arrayProduct: []
                                        }
                                    }
                                    const { productId, quantity , ...restOfProduct } = item.product
                                    store[storeId].arrayProduct.push({ productId, ...restOfProduct, quantity: totalQuantity , detailBerlangsung })
                                    jumlah_uang = 0
                                    Object.keys(store).forEach(key => {
                                        data.push({ ...rest, status, ...store[key], dibatalkanOleh: null })
                                    })
                                }
                            }
                            
                        }
                    } 
                    ///Model Orderan Selain Belum Dibayar
                    else {
                        const store = {}
                        for (const item of order.items) {
                            const storeId = item.product.productId.userId._id.toString()

                            let detailToko;

                            switch (item.product.productId.userId.role) {
                                case "vendor":
                                    detailToko = await TokoVendor.findOne({ userId: storeId }).select('namaToko');
                                    break;
                                case "supplier":
                                    detailToko = await Supplier.findOne({ userId: storeId });
                                    break;
                                case "produsen":
                                    detailToko = await Produsen.findOne({ userId: storeId });
                                    break;
                            }

                            const dataProduct = await DataProductOrder.findOne({pesananId: order._id})
                            const productSelected = dataProduct.dataProduct.find(prod => { return prod._id.toString() === item.product.productId._id })
                            
                            const pengiriman = await Pengiriman.findOne({
                                orderId: order._id, 
                                productToDelivers: {
                                    $elemMatch: {
                                        productId: item.product.productId._id
                                    }
                                }
                            }).lean()

                            const totalQuantity = pengiriman.productToDelivers.reduce((accumulator, currentValue) => {
                                return accumulator + currentValue.quantity;
                            }, 0);
                            
                            detailBerlangsung = pengiriman.status_pengiriman? pengiriman.status_pengiriman : null
                            jumlah_uang += productSelected.total_price * totalQuantity + pengiriman.total_ongkir
                            if (!store[storeId]) {
                                store[storeId] = {
                                    total_pesanan: jumlah_uang,
                                    seller: {
                                        _id: item.product.productId.userId._id,
                                        idToko: detailToko._id,
                                        namaToko: detailToko.namaToko
                                    },
                                    status_pengiriman: pengiriman,
                                    arrayProduct: []
                                }
                            }
                            const { productId, ...restOfProduct } = item.product
                            store[storeId].arrayProduct.push({ productId: productSelected, ...restOfProduct , detailBerlangsung })
                            jumlah_uang = 0
                        }
                        Object.keys(store).forEach(key => {
                            data.push({ ...rest, status, ...store[key], dibatalkanOleh: null })
                        })
                    }
                }
                const filteredData = data.filter(ord => {
                    if(!status) return true
                    return ord.status === status;
                }).sort((a,b)=>{
                    if (a.status === 'Belum Bayar' && b.status !== 'Belum Bayar') {
                        return -1;
                    }
                    if (a.status !== 'Belum Bayar' && b.status === 'Belum Bayar') {
                        return 1;
                    }
                    return 0;
                })
                return res.status(200).json({ message: 'get data all Order success', data: filteredData })
            } else if (req.user.role === 'produsen' || req.user.role === 'supplier' || req.user.role === 'vendor') {
                const products = await Product.find({userId: req.user.id});
                const productIds = products.map(item => { return item._id });

                const filter = {
                    items: {
                        $elemMatch: {
                          'product.productId': { $in: productIds }
                        }
                    },
                    status: {
                        $ne: "Belum Bayar"
                    }
                }
                
                dataOrders = await Pesanan.aggregate([
                    { $match: filter },
                    { $unwind: "$items" },
                    { $unwind: "$shipments" },
                    { $unwind: "$items.product" },
                    {
                        $lookup:{
                            from: "distributtors",
                            foreignField: '_id',
                            localField: "shipments.id_distributor",
                            as: 'dataDistributor'
                        }
                    },
                    { $unwind: "$dataDistributor" },
                    {
                        $addFields:{
                            dataPengiriman: "$dataDistributor"
                        }
                    },
                    {
                        $lookup: {
                            from: 'products',
                            let: { productIds: '$items.product.productId' },
                            pipeline: [
                                { $match: { $expr: { $eq: ['$_id', '$$productIds'] } } },
                                { $project: { _id: 1, name_product: 1, image_product: 1, categoryId: 1, userId: 1, total_price: 1 } }
                            ],
                            as: 'productInfo'
                        }
                    },
                    { $unwind: "$productInfo" },
                    {
                        $addFields: { 'items.product.productId': "$productInfo" }
                    },
                    {
                        $project: { productInfo: 0 }
                    },
                    {
                        $lookup:{
                            from: "konsumens",
                            foreignField: "userId",
                            localField: "userId",
                            as: "konsumens_detail"
                        },
                    },
                    {
                        $lookup:{
                            from: "vendors",
                            foreignField: "userId",
                            localField: "userId",
                            as: "vendors_detail"
                        },
                    },
                    {
                        $lookup:{
                            from: "suppliers",
                            foreignField: "userId",
                            localField: "userId",
                            as: "suppliers_detail"
                        },
                    },
                    {
                        $lookup:{
                            from: "produsens",
                            foreignField: "userId",
                            localField: "userId",
                            as: "produsens_detail"
                        },
                    },
                    {
                        $addFields: {
                            userId: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: ["$konsumens_detail", "$vendors_detail", "$suppliers_detail", "$produsens_detail"],
                                            as: "detail",
                                            cond: { $gt: [{ $size: "$$detail" }, 0] }
                                        }
                                    },
                                    0
                                ]
                            }
                        }
                    },
                    {
                        $lookup:{
                            from: "addresses",
                            foreignField: "_id",
                            localField: "addressId",
                            as: "detailAlamat"
                        },
                    },
                    {
                        $unwind: "$detailAlamat"
                    },
                    {
                        $addFields:{
                            addressId: "$detailAlamat"
                        }
                    },
                    {
                        $project: {
                            konsumens_detail: 0,
                            vendors_detail: 0,
                            suppliers_detail: 0,
                            produsens_detail: 0,
                            detailAlamat: 0,
                            dataDistributor: 0
                        }
                    },
                    
                    {
                        $unwind:"$userId"
                    },
                    {
                        $group: {
                          _id: {
                            orderId: "$_id",
                            sellerId: "$items.product.productId.userId",
                            distributorId: "$dataPengiriman._id"
                          },
                          items: {
                            $push: "$items"
                          },
                          addressId: { $first: "$addressId" },
                          dataPengiriman: { $first: "$dataPengiriman" },
                          userId: { $first: "$userId" },
                          date_order: { $first: "$date_order" },
                          status: { $first: "$status" },
                          poinTerpakai: { $first: "$poinTerpakai" },
                          biaya_asuransi: { $first: "$biaya_asuransi" },
                          dp: { $first: "$dp" },
                          expire: { $first: "$expire" },
                          createdAt: { $first: "$createdAt" },
                          updatedAt: { $first: "$updatedAt" },
                        }
                    },
                ]);

                return res.status(200).json({ message: 'get data all Order success', data: dataOrders })
            }
        } catch (error) {
            if (error && error.name === 'ValidationError') {
                return res.status(400).json({
                    error: true,
                    message: error.message,
                    fields: error.fields
                })
            }
            next(error)
        }
    },

    getOrderDetail: async (req, res, next) => {
        try {
            // const dataOrder = await Orders.findById(req.params.id).populate('')
            const { status } = req.body
            const dataOrder = await Orders.aggregate([
                {
                    $match: {
                        _id: new mongoose.Types.ObjectId(req.params.id),
                        userId: new mongoose.Types.ObjectId(req.user.id)
                    }
                },
                {
                    $project: {
                        shipments: 0 
                    }
                },
                {
                    $lookup: {
                        from: "detailpesanans",
                        foreignField: 'id_pesanan',
                        localField: "_id",
                        as: "order_detail"
                    }
                },
                {
                    $unwind: "$order_detail"
                },
                {
                    $unwind: "$items"
                },
                {
                    $unwind: "$items.product"
                },
                {
                    $lookup: {
                        from: "products",
                        let: { productId: "$items.product.productId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$productId"] } } },
                            { $project: { name_product: 1, image_product: 1, userId: 1, total_price: 1 } }
                        ],
                        as: "product_detail"
                    }
                },
                { $unwind: "$product_detail" },
                { $addFields: { 'items.product.productId': "$product_detail" }},
                { $project: { product_detail: 0 }},
                {
                    $lookup: {
                        from: "users",
                        let: { userId: "$items.product.productId.userId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                            { $project: { role: 1, _id: 1 } }
                        ],
                        as: "user_detail"
                    }
                },
                { $unwind: "$user_detail" },
                { $addFields: { 'items.product.productId.userId': "$user_detail" }},
                { $project: { user_detail: 0 }},
                {
                    $lookup: {
                        from: "addresses",
                        foreignField: '_id',
                        localField: "addressId",
                        as: "alamat"
                    }
                },
                {
                    $unwind: "$alamat"
                },
                {
                    $addFields: {
                        addressId: "$alamat"
                    }
                },
                { $project: { alamat: 0 } },
                {
                    $group: {
                        _id: "$_id",
                        items: {
                            $push: {
                                product: "$items.product",
                                deadline: '$items.deadline',
                                kode_pesanan: '$items.kode_pesanan'
                            }
                        },
                        userId: { $first: "$userId" },
                        order_detail: { $first: "$order_detail" },
                        addressId: { $first: "$addressId" },
                        expire: { $first: "$expire" },
                        status: { $first: "$status" },
                        biaya_awal_asuransi: { $first: "$biaya_awal_asuransi" },
                        biaya_awal_proteksi: { $first: "$biaya_awal_proteksi" }

                    }
                },
                {
                    $project: {
                        data: {
                            _id: "$_id",
                            items: "$items",
                            userId: "$userId",
                            addressId: "$addressId",
                            order_detail: "$order_detail",
                            expire: "$expire",
                            status: "$status",
                            biaya_awal_asuransi: "$biaya_awal_asuransi",
                            biaya_awal_proteksi: "$biaya_awal_proteksi"
                        }
                    }
                },
                {
                    $replaceRoot: { newRoot: "$data" }
                }
            ]);
            if(!dataOrder[0]) return res.status(404).json({message: `Order dengan id: ${req.params.id} tidak ditemukan`})
            const { _id, items, order_detail, ...restOfOrder } = dataOrder[0]

            const transaksi = await Transaksi.findOne({id_pesanan: _id, subsidi: false})
            const transaksiSubsidi = await Transaksi.exists({id_pesanan: _id, subsidi: true})

            const promises = Object.keys(order_detail).map(async (key) => {
                const paymentMethods = ['id_va', 'id_wallet', 'id_gerai_tunai', 'id_fintech'];
                if (paymentMethods.includes(key) && dataOrder[0].order_detail[key] !== null) {
                    switch (key) {
                        case "id_va":
                            return await VirtualAccount.findById(dataOrder[0].order_detail[key]).lean();
                        case "id_wallet":
                            return await Ewallet.findById(dataOrder[0].order_detail[key]).lean();
                        case "id_gerai_tunai":
                            return await GeraiRetail.findById(dataOrder[0].order_detail[key]).lean();
                        case "id_fintech":
                            return await Fintech.findById(dataOrder[0].order_detail[key]).lean();
                        default:
                            return null;
                    }
                } else {
                    return null;
                }
            });
            const paymentMethod = await Promise.all(promises)
            let data;
            let total_pesanan = 0;
            if( status === "Belum Bayar" && transaksi && transaksiSubsidi){
                const store = {};
                const invoiceTambahan = await Invoice.findOne({id_transaksi: transaksi._id, status: { $in: ["Belum Lunas", "Lunas"] }});
                
                const pengiriman = await Pengiriman.findOne({
                    orderId: req.params.id,
                    invoice: invoiceTambahan._id
                });
                
                for(const item of items){
                    const { product, ...restOfItem } = item
                    let detailToko;
                    const { productId, quantity , ...restOfItemProduct } = item.product
                    const { userId, ...restOfProduct } = productId
                    const user = await User.findById(userId._id).select('email phone').lean()
                    switch(userId.role){
                        case "vendor":
                            detailToko = await TokoVendor.findOne({ userId: userId._id }).select('namaToko address').populate('address').lean();
                            break;
                        case "supplier":
                            detailToko = await Supplier.findOne({ userId: userId._id }).lean();
                            break;
                        case "produsen":
                            detailToko = await Produsen.findOne({ userId: userId._id }).lean();
                        break;
                    }
                    const productToDeliver = pengiriman.productToDelivers.find( prod => prod.productId.toString() === productId._id )
                    total_pesanan +=  productToDeliver.quantity * productId.total_price + pengiriman.total_ongkir
                    if(!store[userId._id]){
                        store[userId._id] = {
                            toko: { 
                                userIdSeller: user._id,
                                email: user.email.content, 
                                phone: user.phone.content,  
                                ...detailToko, 
                                ...restOfItem, 
                                status_pengiriman: null
                            },
                            products: []
                        }
                    }
                    store[userId._id].products.push({ ...restOfProduct, ...restOfItemProduct, quantity: productToDeliver.quantity })
                };

                const newItem = Object.keys(store).map(key => { return store[key] })
                const pembatalan = await Pembatalan.findOne({pesananId: _id, userId: req.user.id });
                // let potongan_ongkir = 0, total_ongkir = 0;
    
                const pay = paymentMethod.find(item =>{ return item !== null })
                const paymentNumber = await VirtualAccountUser.findOne({userId: req.user.id, nama_bank: pay._id}).select("nomor_va").lean()
                data = {
                    _id,
                    item: newItem,
                    ...restOfOrder,
                    invoice: invoiceTambahan,
                    transaction_detail: transaksi,
                    pengiriman,
                    paymentMethod: { ...pay, paymentNumber } ,
                    dibatalkanOleh: pembatalan? pembatalan.canceledBy : null,
                    total_pesanan
                    // pengiriman: {
                    //     potongan_ongkir,
                    //     total_ongkir
                    // }
                }
            }else if( (status !== "Belum Bayar" && transaksiSubsidi && transaksi) || (status !== "Belum Bayar" && transaksiSubsidi && !transaksi) ){
                const store = {};
                const invoiceSubsidi = await Invoice.findOne({id_transaksi: transaksiSubsidi._id});
                
                const pengiriman = await Pengiriman.findOne({
                    orderId: req.params.id,
                    invoice: invoiceSubsidi._id
                });
                
                for(const item of items){
                    const { product, ...restOfItem } = item
                    let detailToko;
                    const { productId, quantity , ...restOfItemProduct } = item.product
                    const { userId, ...restOfProduct } = productId
                    const user = await User.findById(userId._id).select('email phone').lean()
                    switch(userId.role){
                        case "vendor":
                            detailToko = await TokoVendor.findOne({ userId: userId._id }).select('namaToko address').populate('address').lean();
                            break;
                        case "supplier":
                            detailToko = await Supplier.findOne({ userId: userId._id }).lean();
                            break;
                        case "produsen":
                            detailToko = await Produsen.findOne({ userId: userId._id }).lean();
                        break;
                    }
                    const productToDeliver = pengiriman.productToDelivers.find( prod => prod.productId.toString() === productId._id )
                    total_pesanan +=  productToDeliver.quantity * productId.total_price + pengiriman.total_ongkir
                    if(!store[userId._id]){
                        store[userId._id] = {
                            toko: { 
                                userIdSeller: user._id,
                                email: user.email.content, 
                                phone: user.phone.content,  
                                ...detailToko, 
                                ...restOfItem, 
                                status_pengiriman: null
                            },
                            products: []
                        }
                    }
                    store[userId._id].products.push({ ...restOfProduct, ...restOfItemProduct, quantity: productToDeliver.quantity })
                };

                const newItem = Object.keys(store).map(key => { return store[key] })
                const pembatalan = await Pembatalan.findOne({pesananId: _id, userId: req.user.id });
                // let potongan_ongkir = 0, total_ongkir = 0;
    
                const pay = paymentMethod.find(item =>{ return item !== null })
                const paymentNumber = await VirtualAccountUser.findOne({userId: req.user.id, nama_bank: pay._id}).select("nomor_va").lean()
                data = {
                    _id,
                    item: newItem,
                    ...restOfOrder,
                    invoice: invoiceSubsidi,
                    transaction_detail: transaksiSubsidi,
                    pengiriman,
                    paymentMethod: { ...pay, paymentNumber } ,
                    dibatalkanOleh: pembatalan? pembatalan.canceledBy : null,
                    total_pesanan
                    // pengiriman: {
                    //     potongan_ongkir,
                    //     total_ongkir
                    // }
                }
            }


            // if(dataOrder[0].status === "Belum Bayar" || dataOrder[0].status === "Dibatalkan"){
            //     const store = {}
            //     for(const item of items){
            //         const { product, ...restOfItem } = item
            //         let detailToko;
            //         const { productId, ...restOfItemProduct } = item.product
            //         const { userId, ...restOfProduct } = productId
            //         const user = await User.findById(userId._id).select('email phone').lean()
            //         switch(userId.role){
            //             case "vendor":
            //                 detailToko = await TokoVendor.findOne({ userId: userId._id }).select('namaToko address').populate('address').lean();
            //                 break;
            //             case "supplier":
            //                 detailToko = await Supplier.findOne({ userId: userId._id }).lean();
            //                 break;
            //             case "produsen":
            //                 detailToko = await Produsen.findOne({ userId: userId._id }).lean();
            //             break;
            //         }
                    
            //         if(!store[userId._id]){
            //             store[userId._id] = {
            //                 toko: { 
            //                     userIdSeller: user._id,
            //                     email: user.email.content, 
            //                     phone: user.phone.content,  
            //                     ...detailToko, 
            //                     ...restOfItem, 
            //                     status_pengiriman: null
            //                 },
            //                 products: []
            //             }
            //         }
            //         store[userId._id].products.push({ ...restOfProduct, ...restOfItemProduct})
            //     }
            //     const pengiriman = await Pengiriman.find({
            //         orderId: req.params.id,
            //     });
            //     const newItem = Object.keys(store).map(key => { return store[key] })
            //     const pembatalan = await Pembatalan.findOne({pesananId: _id, userId: req.user.id });
            //     let potongan_ongkir = 0, total_ongkir = 0;
            //     pengiriman.forEach(item => {
            //         potongan_ongkir += item.potongan_ongkir;
            //         total_ongkir += item.total_ongkir;
            //     })
            //     const pay = paymentMethod.find(item =>{ return item !== null })
            //     const paymentNumber = await VirtualAccountUser.findOne({userId: req.user.id, nama_bank: pay._id}).select("nomor_va").lean()
            //     data = {
            //         _id,
            //         item: newItem,
            //         ...restOfOrder,
            //         paymentMethod: { ...pay, paymentNumber } ,
            //         dibatalkanOleh: pembatalan? pembatalan.canceledBy : null,
            //         pengiriman: {
            //             potongan_ongkir,
            //             total_ongkir
            //         }
            //     }
            // }
            // else if(dataOrder[0].status !== "Belum Bayar" || dataOrder[0].status !== "Dibatalkan"){
            //     if(!productId) return res.status(400).json({message: "Kirimkan array dari productId"})
            //     const store = {}
            //     for(const item of items){
            //         let { product, ...restOfItem } = item
            //         let detailToko;
            //         const { productId, dataProduct , ...restOfItemProduct } = item.product
            //         const { userId, ...restOfProduct } = productId
            //         const user = await User.findById(userId._id).select('email phone').lean()
            //         const pengiriman = await Pengiriman.findOne({
            //             orderId: req.params.id, 
            //             productToDelivers: {
            //                 $elemMatch: {
            //                     productId: { $in: productId }
            //                 }
            //             }
            //         }).populate('distributorId').populate('id_jenis_kendaraan').populate('jenis_pengiriman').lean()
            //         switch(userId.role){
            //             case "vendor":
            //                 detailToko = await TokoVendor.findOne({ userId: userId._id }).select('namaToko address').populate('address').lean();
            //                 break;
            //             case "supplier":
            //                 detailToko = await Supplier.findOne({ userId: userId._id }).lean();
            //                 break;
            //             case "produsen":
            //                 detailToko = await Produsen.findOne({ userId: userId._id }).lean();
            //             break;
            //         }

            //         if(!store[userId._id]){
            //             store[userId._id] = {
            //                 toko: { 
            //                     userIdSeller: user._id,
            //                     email: user.email.content, 
            //                     phone: user.phone.content , 
            //                     ...detailToko, 
            //                     ...restOfItem, 
            //                     status_pengiriman: pengiriman 
            //                 },
            //                 products: []
            //             }
            //         }
            //         store[userId._id].products.push({...dataProduct, ...restOfItemProduct})
            //     }
            //     const newItem = Object.keys(store).map(key => { return store[key] })
            //     let total_pesanan = 0
            //     const result = newItem.map(toko => {
            //         return {
            //           ...toko,
            //           products: toko.products.filter(product => productId.includes(product._id))
            //         };
            //     }).filter(toko => toko.products.length > 0);

            //     result.forEach(item => {
            //         total_pesanan += item.toko.status_pengiriman.total_ongkir;
            //         item.products.forEach(prod =>{
            //             total_pesanan += prod.total_price * prod.quantity;
            //         })
            //     })
            //     data = {
            //         _id,
            //         item: result,
            //         ...restOfOrder,
            //         paymentMethod: paymentMethod.find(item =>{ return item !== null }),
            //         total_pesanan,
            //         dibatalkanOleh: null
            //     }
            // }
            return res.status(200).json({ message: 'get detail data order success', data });
        } catch (error) {
            console.error('Error fetching order:', error);
            next(error);
        }
    },

    createOrder: async (req, res, next) => {
        try {
            const {
                metode_pembayaran,
                total,
                items,
                shipments,
                dp,
                biaya_asuransi,
                biaya_jasa_aplikasi,
                biaya_layanan,
                poin_terpakai,
                sekolahId
            } = req.body
            console.log(JSON.stringify(req.body))
            if (Object.keys(req.body).length === 0) return res.status(400).json({ message: "Request Body tidak boleh kosong!" });
            if(!sekolahId) return res.status(400).json({message: "Kirimkan Id Sekolah"})
            if (!req.body["items"]) return res.status(404).json({ message: "Tidak ada data items yang dikirimkan, tolong kirimkan data items yang akan dipesan" })
            if (!Array.isArray(req.body['items'])) return res.status(400).json({ message: "Body items bukan array, kirimkan array" })

            let total_pesanan = await Orders.countDocuments({
                createdAt: {
                    $gte: now,
                    $lt: tomorrow
                }
            });

            const user = await User.findById(req.user.id)

            items.forEach((item, index) => {
                item.kode_pesanan = `PSN_${user.get('kode_role')}_${date}_${minutes}_${total_pesanan + index + 1}`;
                total_pesanan += 1
            });

            const productIds = items.flatMap(item =>
                item.product.map(prod => prod.productId)
            );

            const products = await Product.find({ _id: { $in: productIds } }).select('_id')
            for (const prod of productIds) {
                const found = products.some(item => item._id === prod);
                if (!found) return res.status(404).json({ message: `Produk dengan id ${prod} tidak ditemukan` })
            }

            if (items.length !== shipments.length) return res.status(400).json({ message: "Data Toko tidak sama dengan dengan data pengiriman" })

            let va_user;
            let VirtualAccount;
            let idPay;
            let nama;

            const splitted = metode_pembayaran.split(" / ");
            if (splitted[1].replace(/\u00A0/g, ' ') == "Virtual Account") {
                va_user = await VaUser.findOne({
                    nama_bank: splitted[0],
                    userId: req.user.id
                }).populate('nama_bank')
                VirtualAccount = await VA.findById(splitted[0]);
                if (!va_user) return res.status(404).json({ message: "User belum memiliki virtual account " + VirtualAccount.nama_bank });
                idPay = va_user.nama_bank._id,
                    nama = va_user.nama_virtual_account
            } else {
                paymentNumber = "123"
            }

            const va_used = await VA_Used.findOne({
                nomor_va: va_user.nomor_va.split(VirtualAccount.kode_perusahaan)[1],
                userId: req.user.id
            })

            if (va_used) return res.status(403).json({ message: "Sedang ada transaki dengan virtual account ini", data: va_used });
            const decimalPattern = /^\d+\.\d+$/;
            if (decimalPattern.test(total)) return res.status(400).json({ message: `Total yang dikirimkan tidak boleh decimal. ${total}` })
            const idPesanan = new mongoose.Types.ObjectId()

            const a_day_later = new Date(today.getTime() + 24 * 60 * 60 * 1000)

            const dataOrder = await Orders.create({
                ...req.body,
                userId: req.user.id,
                date_order: date,
                biaya_asuransi: biaya_asuransi ? true : false,
                expire: a_day_later
            });

            let total_pengiriman = await Pengiriman.countDocuments({
                createdAt: {
                    $gte: now,
                    $lt: tomorrow
                }
            });
            
            const promisesFunct = []

            const detailPesanan = await DetailPesanan.create({
                _id: idPesanan,
                id_pesanan: dataOrder._id,
                total_price: total,
                jumlah_dp: total * dp.value,
                id_va: metode_pembayaran.includes("Virtual Account") ? idPay : null,
                id_fintech: metode_pembayaran.includes("Fintech") ? idPay : null,
                id_gerai_tunai: metode_pembayaran.includes("Gerai") ? idPay : null,
                id_ewallet: metode_pembayaran.includes("E-Wallet") ? idPay : null,
                biaya_jasa_aplikasi,
                biaya_layanan,
                biaya_asuransi
            });
            const total_transaksi = await Transaksi.countDocuments({
                createdAt: {
                    $gte: now,
                    $lt: tomorrow
                }
            });

            const sekolah = await Sekolah.findOne({_id: sekolahId, userId: req.user.id})
            if(!sekolah) return res.status(404).json({message: "Tidak ada sekolah yang ditemukan"})
            let totalQuantity = 0
            const ids = []
            items.map(item => {
                item.product.map(prod => ids.push(prod.productId))
                item.product.map( prod => {
                    totalQuantity += prod.quantity
                })
            })
            const arrayProducts = await Product.find({_id: {$in: ids}}).populate({path: "userId", select: "_id role"}).populate('categoryId').lean()
            let transaksiMidtrans;
            let total_tagihan = 0;

            if ((sekolah.jumlahMurid === totalQuantity) || (sekolah.jumlahMurid > totalQuantity)) {
                const kode_transaksi = await Transaksi.create({
                    id_pesanan: dataOrder._id,
                    jenis_transaksi: "keluar",
                    status: "Menunggu Pembayaran",
                    subsidi: true,
                    kode_transaksi: `TRX_${user.get('kode_role')}_OUT_SYS_${date}_${minutes}_${total_transaksi + 1}`
                });

                const invoice = await Invoice.create({
                    id_transaksi: kode_transaksi,
                    userId: req.user.id,
                    status: "Piutang",
                    kode_invoice: `INV_${user.get('kode_role')}_${date}_${minutes}_${total_transaksi + 1}`
                });

                for (let i = 0; i < dataOrder.shipments.length; i++) {
                    promisesFunct.push(
                        Pengiriman.create({
                            orderId: dataOrder._id,
                            distributorId: dataOrder.shipments[i].id_distributor,
                            productToDelivers: dataOrder.shipments[i].products,
                            waktu_pengiriman: new Date(dataOrder.items[i].deadline),
                            total_ongkir: dataOrder.shipments[i].total_ongkir,
                            ongkir: dataOrder.shipments[i].ongkir,
                            potongan_ongkir: dataOrder.shipments[i].potongan_ongkir,
                            jenis_pengiriman: dataOrder.shipments[i].id_jenis_layanan,
                            id_jenis_kendaraan: dataOrder.shipments[i].id_jenis_kendaraan,
                            id_toko: dataOrder.shipments[i].id_toko_vendor,
                            kode_pengiriman: `PNR_${user.kode_role}_${date}_${minutes}_${total_pengiriman + 1}`,
                            invoice: invoice._id
                        })
                    );
                    total_pengiriman += 1;
                }

                promisesFunct.push(
                    DataProductOrder.create({
                        transaksiId: kode_transaksi._id,
                        pesananId: dataOrder._id,
                        dataProduct: arrayProducts
                    }),
                    Orders.findByIdAndUpdate(dataOrder._id, { status: "Berlangsung" })
                )

            } else if (totalQuantity > sekolah.jumlahMurid) {
                let baseOngkir
                const kode_transaksi_piutang = await Transaksi.create({
                    id_pesanan: dataOrder._id,
                    jenis_transaksi: "keluar",
                    status: "Menunggu Pembayaran",
                    subsidi: true,
                    kode_transaksi: `TRX_${user.get('kode_role')}_OUT_SYS_${date}_${minutes}_${total_transaksi + 1}`
                });

                const invoiceSubsidi = await Invoice.create({
                    id_transaksi: kode_transaksi_piutang,
                    userId: req.user.id,
                    status: "Piutang",
                    kode_invoice: `INV_${user.get('kode_role')}_${date}_${minutes}_${total_transaksi + 1}`
                });

                for (let i = 0; i < dataOrder.shipments.length; i++) {
                    let totalProduk = 0;
                    const productToDelivers = dataOrder.shipments[i].products.map(prod => {
                        const { quantity, ...restOfProd } = prod;
                        totalProduk += quantity;
                        return {
                            ...restOfProd,
                            quantity: sekolah.jumlahMurid
                        };
                    });

                    if (totalProduk === 0) throw new Error("Total products cannot be zero.");

                    baseOngkir = dataOrder.shipments[i].total_ongkir / totalProduk;
                    promisesFunct.push(
                        Pengiriman.create({
                            orderId: dataOrder._id,
                            distributorId: dataOrder.shipments[i].id_distributor,
                            productToDelivers,
                            waktu_pengiriman: new Date(dataOrder.items[i].deadline),
                            total_ongkir: Math.round(sekolah.jumlahMurid * baseOngkir),
                            ongkir: dataOrder.shipments[i].ongkir,
                            potongan_ongkir: dataOrder.shipments[i].potongan_ongkir,
                            jenis_pengiriman: dataOrder.shipments[i].id_jenis_layanan,
                            id_jenis_kendaraan: dataOrder.shipments[i].id_jenis_kendaraan,
                            id_toko: dataOrder.shipments[i].id_toko_vendor,
                            kode_pengiriman: `PNR_${user.kode_role}_${date}_${minutes}_${total_pengiriman + 1}`,
                            invoice: invoiceSubsidi._id
                        })
                    );
                }

                promisesFunct.push(
                    DataProductOrder.create({
                        transaksiId: kode_transaksi_piutang._id,
                        pesananId: dataOrder._id,
                        dataProduct: arrayProducts
                    })
                )

                const kode_transaksi = await Transaksi.create({
                    id_pesanan: dataOrder._id,
                    jenis_transaksi: "keluar",
                    status: "Menunggu Pembayaran",
                    subsidi: false,
                    kode_transaksi: `TRX_${user.get('kode_role')}_OUT_SYS_${date}_${minutes}_${total_transaksi + 1}`
                });

                const invoiceNonSubsidi = await Invoice.create({
                    id_transaksi: kode_transaksi,
                    userId: req.user.id,
                    status: "Belum Lunas",
                    kode_invoice: `INV_${user.get('kode_role')}_${date}_${minutes}_${total_transaksi + 1}`
                });

                for (let i = 0; i < dataOrder.shipments.length; i++) {
                    let totalProduk = 0;
                    const productToDelivers = await Promise.all(dataOrder.shipments[i].products.map(async prod => {
                        const product = await Product.findById(prod.productId).select('total_price');
                        const { quantity, ...restOfProd } = prod;
                        total_tagihan += product.total_price * (totalQuantity - sekolah.jumlahMurid);
                        totalProduk += quantity;
                        return {
                            ...restOfProd,
                            quantity: totalQuantity - sekolah.jumlahMurid
                        };
                    }));
                    if (totalProduk === 0) throw new Error("Total products cannot be zero.");

                    promisesFunct.push(
                        Pengiriman.create({
                            orderId: dataOrder._id,
                            distributorId: dataOrder.shipments[i].id_distributor,
                            productToDelivers,
                            waktu_pengiriman: new Date(dataOrder.items[i].deadline),
                            total_ongkir: Math.round((totalQuantity - sekolah.jumlahMurid) * baseOngkir),
                            ongkir: dataOrder.shipments[i].ongkir,
                            potongan_ongkir: dataOrder.shipments[i].potongan_ongkir,
                            jenis_pengiriman: dataOrder.shipments[i].id_jenis_layanan,
                            id_jenis_kendaraan: dataOrder.shipments[i].id_jenis_kendaraan,
                            id_toko: dataOrder.shipments[i].id_toko_vendor,
                            kode_pengiriman: `PNR_${user.kode_role}_${date}_${minutes}_${total_pengiriman + 1}`,
                            invoice: invoiceNonSubsidi._id
                        })
                    );

                    total_tagihan += (totalQuantity - sekolah.jumlahMurid) * baseOngkir + (biaya_jasa_aplikasi + biaya_layanan + biaya_asuransi);
                    total_pengiriman += 1;
                }

                const grossAmount = () => {
                    if (dp.isUsed && poin_terpakai) {
                        return (dp.value * Math.round(total_tagihan)) - poin_terpakai;
                    } else if (dp.isUsed) {
                        return dp.value * Math.round(total_tagihan);
                    } else {
                        return Math.round(total_tagihan);
                    }
                };

                const options = {
                    method: 'POST',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        Authorization: `Basic ${btoa(process.env.SERVERKEY + ':')}`
                    },
                    body: JSON.stringify({
                        payment_type: 'bank_transfer',
                        transaction_details: {
                            order_id: idPesanan,
                            gross_amount: grossAmount()
                        },
                        bank_transfer: {
                            bank: 'bca',
                            va_number: va_user.nomor_va.split(VirtualAccount.kode_perusahaan)[1]
                        },
                    })
                };

                const respon = await fetch(`${process.env.MIDTRANS_URL}/charge`, options);
                transaksiMidtrans = await respon.json();

                promisesFunct.push(
                    VA_Used.create({
                        userId: req.user.id,
                        orderId: detailPesanan._id,
                        nomor_va: va_user.nomor_va.split(VirtualAccount.kode_perusahaan)[1]
                    })
                )
            }

            await Promise.all(promisesFunct)
            
            return res.status(201).json({
                message: `Berhasil membuat Pesanan dengan Pembayaran ${splitted[1]}`,
                datas: dataOrder,
                nama,
                paymentNumber: transaksiMidtrans ? transaksiMidtrans.va_numbers[0].va_number : null,
                total_tagihan,
                transaksi: transaksiMidtrans? {
                    waktu: transaksiMidtrans.transaction_time,
                    orderId: transaksiMidtrans.order_id
                } : null
            });

        } catch (error) {
            console.log(error)
            if (error && error.name == "ValidationError") {
                return res.status(400).json({
                    error: true,
                    message: error.message,
                    fields: error.fields,
                });
            }
            next(error)
        }
    },

    update_shipments: async(req, res, next) => {
        try {
            const { 
                old_id_toko_vendor, 
                old_id_distributor, 
                new_id_distributor, 
                total_ongkir, 
                potongan_ongkir, 
                ongkir, 
                id_jenis_kendaraan, 
                id_jenis_layanan 
            } = req.body

            const updateFields = {
                'shipments.$.id_distributor': new_id_distributor,
                'shipments.$.total_ongkir': total_ongkir,
                'shipments.$.ongkir': ongkir,
                'shipments.$.potongan_ongkir': potongan_ongkir,
                'shipments.$.id_jenis_kendaraan': id_jenis_kendaraan,
                'shipments.$.id_jenis_layanan': id_jenis_layanan,
            };

            const order = await Orders.findOne(
                { _id: req.params.id, userId: req.user.id, 'shipments.id_distributor': old_id_distributor, 'shipments.id_toko_vendor': old_id_toko_vendor, status: "Berlangsung" },
            ).lean();
            
            if(!order) return res.status(404).json({message: "Tidak ditemukan order dan pengiriman"});

            const filteredIndex = order.shipments.findIndex( item => {
                return item.id_distributor.toString() === old_id_distributor && item.id_toko_vendor.toString() === old_id_toko_vendor
            });
            
            const products = order.shipments[filteredIndex].products.map( item => {
                return item.productId
            });

            const updatedOrder = await Orders.findOneAndUpdate(
                { _id: req.params.id, userId: req.user.id, 'shipments.id_distributor': old_id_distributor, 'shipments.id_toko_vendor': old_id_toko_vendor },
                { $set: updateFields },
                { new: true }
            )

            const pengiriman = await Pengiriman.findOneAndUpdate(
                {
                    orderId: updatedOrder._id,
                    productToDelivers: {
                        $elemMatch: {
                            productId: { $in: products }
                        }
                    }
                },
                {
                    distributorId: new_id_distributor,
                    rejected: false,
                    total_ongkir,
                    potongan_ongkir,
                    ongkir,
                    id_jenis_kendaraan,
                    id_jenis_layanan
                }
            );

            return res.status(200).json({data: updatedOrder, pengiriman})
        } catch (error) {
            console.log(error);
            next(error)
        }
    },

    update_status: async (req, res, next) => {
        try {
            if (!req.body.pesananId || !req.body.status) return res.status(401).json({ message: `Dibutuhkan payload dengan nama pesananId dan status` })
            if (req.body.status !== 'Berhasil') return res.status(400).json({ message: "Status yang dikirimkan tidak valid" })
            const pesanan = await Orders.findById(req.body.pesananId).lean()
            if(!pesanan) return res.status(404).json({message: `Tidak ada pesanan dengan id: ${req.body.pesananId}`})
            const productIds = []
            const ships = []
            pesanan.items.map(item => productIds.push(item.product));
            pesanan.shipments.map(item => ships.push(item))
            if (!pesanan) return res.status(404).json({ message: `pesanan dengan id: ${req.body.pesananID} tidak ditemukan` })
            if (pesanan.userId.toString() !== req.user.id) return res.status(403).json({ message: "Tidak bisa mengubah data orang lain!" })
            const total_transaksi = await Transaksi.countDocuments({
                createdAt: {
                    $gte: now,
                    $lt: tomorrow
                }
            });
            const writeDb = [
                Orders.updateOne({ _id: pesanan._id }, { status: req.body.status }),
            ]
            const finalProduct = productIds.map(item => {
                return item[0].productId
            })
            for (const item of finalProduct) {
                const product = await Product.findById(item);
                const user_seller = await User.findById(product.userId);
                if (user_seller) {
                    writeDb.push(
                        Transaksi.create({
                            id_pesanan: pesanan._id,
                            jenis_transaksi: "masuk",
                            status: "Pembayaran Berhasil",
                            kode_transaksi: `TRX_${user_seller.kode_role}_IN_SYS_${date}_${minutes}_${total_transaksi + 1}`
                        }),
                        Transaksi.create({
                            id_pesanan: pesanan._id,
                            jenis_transaksi: "keluar",
                            status: "Pembayaran Berhasil",
                            kode_transaksi: `TRX_SYS_OUT_${user_seller.kode_role}_${date}_${minutes}_${total_transaksi + 1}`
                        }),
                    );
                }
            }

            for (const item of ships) {
                const user_distributor = await User.findById(item.id_distributor);
                if (user_distributor) {
                    writeDb.push(
                        Transaksi.create({
                            id_pesanan: pesanan._id,
                            jenis_transaksi: "masuk",
                            status: "Pembayaran Berhasil",
                            kode_transaksi: `TRX_${user_distributor.kode_role}_IN_SYS_${date}_${minutes}_${total_transaksi + 1}`
                        }),
                        Transaksi.create({
                            id_pesanan: pesanan._id,
                            jenis_transaksi: "keluar",
                            status: "Pembayaran Berhasil",
                            kode_transaksi: `TRX_SYS_OUT_${user_distributor.kode_role}_${date}_${minutes}_${total_transaksi + 1}`
                        }),
                    );
                }
            }

            writeDb.push(
                Transaksi2.create({
                    jumlah: 20000,
                    jenis_transaksi: "bagian perusahaan",
                    status: "Pembayaran Berhasil",
                    kode_transaksi: `TRX_SYS_OUT_PRH_${date}_${minutes}_${total_transaksi + 1}`
                }),
                Transaksi2.create({
                    jumlah: 20000,
                    jenis_transaksi: "bagian perusahaan",
                    status: "Pembayaran Berhasil",
                    kode_transaksi: `TRX_PRH_IN_SYS_${date}_${minutes}_${total_transaksi + 1}`
                }),
            )

            await Promise.all(writeDb)
            return res.status(200).json({ message: "Berhasil Merubah Status" })
        } catch (err) {
            console.log(err)
            next(err)
        }
    },
    cancelOrder: async (req, res, next) => {
        try {
            const { pesananId, reason } = req.body
            const order = await Pesanan.findOneAndUpdate({ _id: pesananId, userId: req.user.id }, {
                status: "Dibatalkan",
                reason,
                canceledBy: "pengguna"
            })
            const detailPesanan = await DetailPesanan.exists({id_pesanan: pesananId});
            await axios.post(`https://api.sandbox.midtrans.com/v2/${detailPesanan._id}/cancel`, {}, {
                headers: {
                    Authorization: `Basic ${btoa(process.env.SERVERKEY + ':')}`
                }
            })
            await VA_Used.deleteOne({orderId: pesananId, userId: req.user.id})
            if(!order) return res.status(404).json({message: `Tidak ada order dengan id ${pesananId}`})
            return res.status(200).json({message: "Berhasil Membatalkan Order", data: order})
        } catch (error) {
            console.log(error);
            next(error)
        }
    },
    deleteOrder: async (req, res, next) => {
        try {
            const dataOrder = await Orders.findOne({ _id: req.params.id })
            if (dataOrder.userId.toString() !== req.user.id) return res.status(403).json({ message: "Tidak bisa menghapus data orang lain!" })

            if (!dataOrder) return res.status(404).json({ error: 'darta order not Found' })

            await Orders.deleteOne({ _id: req.params.id })

            return res.status(200).json({ message: 'delete data Order success' })
        } catch (error) {
            if (error && error.name === 'ValidationError') {
                return res.status(400).json({
                    error: true,
                    message: error.message,
                    fields: error.fields
                })
            }
            next(error)
        }
    }
}