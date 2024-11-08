const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cron = require('node-cron');
const xlsx = require('xlsx');
const Consumer = require('./models/consumer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

// Function to read consumer data from Excel
const getConsumerData = () => {
    const workbook = xlsx.readFile('consumer_data.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
};

const fetchMeterBalance = async () => {
  const consumerDataArray = getConsumerData();
  
  for (const consumerData of consumerDataArray) {
      const { consumer_id, site_id } = consumerData;

      try {
          const response = await axios.get(`${process.env.API_URL}`, {
              headers: {
                  apikey: process.env.API_KEY,
              },
              params: {
                  site_id: site_id,
                  consumer_id: consumer_id,
              },
          });

          if (response.data.status === "T") {
              const balanceData = response.data.data;
              let consumer = await Consumer.findOne({ consumer_id });

              if (!consumer) {
                  consumer = new Consumer({ consumer_id, site_id, balances: [] });
              }

              consumer.balances = [{
                  meter_no: balanceData.meter_no,
                  balance: balanceData.balance,
                  recorded_at: new Date(),
              }];

              await consumer.save();
              console.log('Balance Updated:', consumer);
          } else {
              console.error('Failed to fetch balance:', response.data.message);
          }
      } catch (error) {
          console.error('Error fetching meter balance:', error.message);
      }
  }
};

cron.schedule('*/10 * * * *', fetchMeterBalance);

app.get('/', (req, res) => {
    res.send('Meter Balance Fetcher is running.');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
