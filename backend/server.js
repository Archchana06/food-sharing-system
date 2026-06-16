const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== AZURE BLOB STORAGE CONFIGURATION ==========
const AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=foodshareimages123;AccountKey=nqpTnY8b1mOXO3wRrfab40I91ODdQpxVK2GmCZEYbr7btU3WvnvF4/Qgb+j1iMeJCAtXlBxe9XFw+AStNV/krA==;EndpointSuffix=core.windows.net';

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = 'food-images';
const upload = multer({ storage: multer.memoryStorage() });

// ========== DATABASE CONFIGURATION ==========
const dbConfig = {
    server: 'foodshare-server-archchana.database.windows.net',
    database: 'FoodSharingDB',
    user: 'azureuser',
    password: 'Dilon2046',
    port: 1433,
    connectionTimeout: 60000,
    requestTimeout: 60000,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// ========== TEST DATABASE CONNECTION ==========
app.get('/api/test', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        res.json({ message: 'Connected to Azure SQL Database successfully!' });
    } catch (err) {
        console.error('Database connection error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========== REGISTER USER ==========
app.post('/api/register', async (req, res) => {
    const { name, email, phone, user_type, password } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('email', sql.NVarChar, email)
            .input('phone', sql.NVarChar, phone)
            .input('user_type', sql.NVarChar, user_type || 'seeker')
            .input('password', sql.NVarChar, password)
            .query(`INSERT INTO Users (name, email, phone, user_type, password, created_at) 
                    VALUES (@name, @email, @phone, @user_type, @password, GETDATE())`);
        
        res.json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== LOGIN USER ==========
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, password)
            .query(`SELECT user_id, name, email, phone, user_type 
                    FROM Users 
                    WHERE email = @email AND password = @password`);
        
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            res.json({ 
                success: true, 
                user: {
                    id: user.user_id,
                    name: user.name,
                    email: user.email,
                    user_type: user.user_type
                }
            });
        } else {
            res.json({ success: false, message: 'Invalid email or password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== POST FOOD WITH IMAGE ==========
app.post('/api/food', async (req, res) => {
    const { user_id, food_name, quantity, location, pickup_time, image_url } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('food_name', sql.NVarChar, food_name)
            .input('quantity', sql.NVarChar, quantity)
            .input('location', sql.NVarChar, location)
            .input('pickup_time', sql.DateTime, pickup_time)
            .input('image_url', sql.NVarChar, image_url || '')
            .query(`INSERT INTO FoodItems (user_id, food_name, quantity, location, pickup_time, status, image_url) 
                    VALUES (@user_id, @food_name, @quantity, @location, @pickup_time, 'Available', @image_url)`);
        
        res.json({ success: true, message: 'Food posted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== UPLOAD IMAGE TO BLOB STORAGE ==========
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }

        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const filename = `food_${timestamp}_${random}${path.extname(req.file.originalname)}`;
        
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        await blockBlobClient.upload(req.file.buffer, req.file.buffer.length);
        
        const imageUrl = blockBlobClient.url;
        
        res.json({ success: true, imageUrl: imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== GET ALL AVAILABLE FOOD (SEEKER) ==========
app.get('/api/food', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .query(`SELECT f.*, u.name as donor_name, u.phone 
                    FROM FoodItems f 
                    JOIN Users u ON f.user_id = u.user_id 
                    WHERE f.status = 'Available' 
                    ORDER BY f.created_at DESC`);
        
        res.json({ success: true, food: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== GET FOOD BY DONOR ID (MY POSTS) ==========
app.get('/api/my-food/:user_id', async (req, res) => {
    const { user_id } = req.params;
    
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('user_id', sql.Int, user_id)
            .query(`SELECT * FROM FoodItems WHERE user_id = @user_id ORDER BY created_at DESC`);
        
        res.json({ success: true, food: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== DELETE FOOD (DONOR) ==========
app.delete('/api/food/:food_id', async (req, res) => {
    const { food_id } = req.params;
    const { user_id } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        
        let checkResult = await pool.request()
            .input('food_id', sql.Int, food_id)
            .input('user_id', sql.Int, user_id)
            .query(`SELECT * FROM FoodItems WHERE food_id = @food_id AND user_id = @user_id`);
        
        if (checkResult.recordset.length === 0) {
            return res.json({ success: false, message: 'You can only delete your own food posts' });
        }
        
        await pool.request()
            .input('food_id', sql.Int, food_id)
            .query(`DELETE FROM FoodItems WHERE food_id = @food_id`);
        
        res.json({ success: true, message: 'Food deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== RESERVE FOOD (SEEKER) ==========
app.post('/api/reserve', async (req, res) => {
    const { food_id, user_id } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('food_id', sql.Int, food_id)
            .query(`UPDATE FoodItems SET status = 'Reserved' WHERE food_id = @food_id`);
        
        await pool.request()
            .input('food_id', sql.Int, food_id)
            .input('user_id', sql.Int, user_id)
            .query(`INSERT INTO Reservations (food_id, user_id, status) 
                    VALUES (@food_id, @user_id, 'Active')`);
        
        res.json({ success: true, message: 'Food reserved successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== GET MY RESERVATIONS (SEEKER) ==========
app.get('/api/my-reservations/:user_id', async (req, res) => {
    const { user_id } = req.params;
    
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('user_id', sql.Int, user_id)
            .query(`SELECT r.*, f.food_name, f.quantity, f.location, f.pickup_time, u.name as donor_name
                    FROM Reservations r
                    JOIN FoodItems f ON r.food_id = f.food_id
                    JOIN Users u ON f.user_id = u.user_id
                    WHERE r.user_id = @user_id`);
        
        res.json({ success: true, reservations: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== GET USER PROFILE ==========
app.get('/api/user/:user_id', async (req, res) => {
    const { user_id } = req.params;
    
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('user_id', sql.Int, user_id)
            .query(`SELECT user_id, name, email, phone, user_type, created_at 
                    FROM Users WHERE user_id = @user_id`);
        
        if (result.recordset.length > 0) {
            res.json({ success: true, user: result.recordset[0] });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== UPDATE USER PROFILE ==========
app.put('/api/user/:user_id', async (req, res) => {
    const { user_id } = req.params;
    const { name, phone } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('name', sql.NVarChar, name)
            .input('phone', sql.NVarChar, phone)
            .query(`UPDATE Users SET name = @name, phone = @phone WHERE user_id = @user_id`);
        
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== CHANGE PASSWORD ==========
app.post('/api/change-password', async (req, res) => {
    const { user_id, old_password, new_password } = req.body;
    
    try {
        let pool = await sql.connect(dbConfig);
        
        // Verify old password
        let checkResult = await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('old_password', sql.NVarChar, old_password)
            .query(`SELECT * FROM Users WHERE user_id = @user_id AND password = @old_password`);
        
        if (checkResult.recordset.length === 0) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }
        
        // Update to new password
        await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('new_password', sql.NVarChar, new_password)
            .query(`UPDATE Users SET password = @new_password WHERE user_id = @user_id`);
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ========== START SERVER ==========
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Test API: http://localhost:${PORT}/api/test`);
});