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

  const sendLowBalanceAlert = async (consumer_id, consumer_name, balance, mobile_no) => {

    try {
        const response = await axios.post('https://rcmapi.instaalerts.zone/services/rcm/sendMessage', {
            "message": {
                "channel": "WABA",
                "content": {
                    "preview_url": false,
                    "type": "TEMPLATE",
                    "template": {
                        "templateId": "lowbalance_alert",
                        "parameterValues": {
                            "0": consumer_name,
                            "1": balance.toString()
                        }
                    }
                },
                "recipient": {
                    "to": mobile_no,
                    "recipient_type": "individual",
                    "reference": {
                        "cust_ref": `cust_ref_${consumer_id}`,
                        "messageTag1": "Low Balance Alert",
                        "messageTag2": "Balance Notification",
                        "messageTag3": "Urgent",
                        "conversationId": `Conv_${consumer_id}`
                    }
                },
                "sender": {
                    "from": "919810806360"
                },
                "preferences": {
                    "webHookDNId": "1001"
                }
            },
            "metaData": {
                "version": "v1.0.9"
            }
        }, {
            headers: {
                'Authentication': 'Bearer gaKB7ss5PE6Q1Qqk91giww==',
                'Content-Type': 'application/json'
            }
        });

        console.log('Low balance alert sent:', response.data);
    } catch (error) {
        console.error('Error sending low balance alert:', error.message);
    }
};

// Function to read consumer data from Excel
const getConsumerData = () => {
    const workbook = xlsx.readFile('consumer_data.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    return jsonData.map(row => ({
      consumer_id: row['Consumer Id'],
      site_id: row['Site Id'],
      mobile_no: row['Mobile No.'],
}))
};

const fetchMeterBalance = async () => {
  const consumerDataArray = getConsumerData();
  
  for (const consumerData of consumerDataArray) {
      const { consumer_id, site_id, mobile_no} = consumerData;

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
              const consumer_name = balanceData.consumer_name;

              let consumer = await Consumer.findOne({ consumer_id });

              if (!consumer) {
                  consumer = new Consumer({ consumer_id, site_id, balances: [] });
              }

              consumer.balances = [{
                  meter_no: balanceData.meter_no,
                  balance: balanceData.balance,
                  consumer_name: consumer_name,
                  mobile_no: mobile_no,
                  recorded_at: new Date(),
              }];

              await consumer.save();
              console.log('Balance Updated:', consumer);

              if(consumer.balances[0].balance < 500 ) {
                  await sendLowBalanceAlert(consumer.consumer_id, consumer_name, consumer.balances[0].balance, mobile_no);
              }
          } else {
              console.error('Failed to fetch balance:', response.data.message);
          }
      } catch (error) {
          console.error('Error fetching meter balance:', error.message);
      }
  }
};
fetchMeterBalance();
//cron.schedule('*/1 * * * *', fetchMeterBalance);

app.get('/', (req, res) => {
    res.send('Meter Balance Fetcher is running.');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
