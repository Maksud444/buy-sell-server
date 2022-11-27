const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, Collection, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ctzede1.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access')
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}


async function run() {
    try {
        const CarsCetagoryCollection = client.db('CarsPortal').collection('CarsCollection');
        const ordersCollection = client.db('CarsPortal').collection('orders');
        const CetagoryCollection = client.db('CarsPortal').collection('Category');
        const usersCollection = client.db('CarsPortal').collection('users');
        // const productsCollection = client.db('CarsPortal').collection('product');


        app.get('/CarsCollection', async (req, res) => {
            const categoryName = req.query.categoryName;
            const query = {};
            const options = await CarsCetagoryCollection.find(query).toArray();


            const categoryQuery = {categoryName: categoryName}
            const alreadyBooked = await CetagoryCollection.find(categoryQuery).toArray();
            options.forEach(option =>{
                const optionBooked = alreadyBooked.filter(book => book.categoryName === option.categoryName);
               const remainingCategory = option.categoryName.filter(ctName => !optionBooked.includes(ctName))
               option.categoryName = remainingCategory; 
               console.log(optionBooked,remainingCategory.length)
            })

          res.send(options)
        });

        app.get('/v2/category', async(req, res) =>{
            const name = req.query.name;
            const options = await CarsCetagoryCollection.aggregate([
                {
                    $lookup:{
                        from: 'Category',
                        localField: 'name',
                        foreignField: 'categoryName',
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$categoryName', name]
                                    }
                                }
                            }
                        ],
                        as: 'booked'
                    }
                },
                {
                    $project:{
                        name: 1,
                        categoryName:1,
                        booked:{
                            $map:{
                                input: '$booked',
                                as: 'book',
                                in: '$$book.ctName'
                            }
                        }
                    }
                },
                {
                    $project:{
                        name: 1,
                        categoryName: {
                            $setDifference: ['$ctName', '$booked']
                        }
                    }
                }
            ]).toArray();
            res.send(options);
        })


        app.get('/category', async(req, res) =>{
            const query = {};
            const cursor = await CetagoryCollection.find(query).toArray();
            res.send(cursor);
         });

        //  category........
        
         app.get('/allcar/:id', async (req, res) => {
            const id = req.params.id;
            const query = { categoryId:id };
            console.log(query);
            const service = await CarsCetagoryCollection.find(query).toArray();
            res.send(service)
        });

        // app.get('/addProduct', async (req, res) => {
        //     const query = {};
        //     const result = await CetagoryCollection.find(query).project({ name: 1 }).toArray();
        //     res.send(result)
        // })

        // add car.........
         app.put('/addcar', async(req, res) =>{
            const query = req.body;
            const result = await CarsCetagoryCollection.insertOne(query);
            res.send(result);
         });

        //  get all car......
        app.get('/myproduct', async (req, res) => {
            const email = req.query.email;
            const query = {email: email};
            console.log(query);
            const result = await CarsCetagoryCollection.find(query).toArray();
            res.send(result);
        })
  

        //----------//
       
        //------------//
        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result)
        })
       
      
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders)
        })

    //    app.get('/orders/:id', async(req, res) =>{
    //     const id = req.params.id;
    //     const query = {_id: ObjectId(id)}
    //     const order = ordersCollection.findOne(query)
    //     res.send(order);
    //    })
    app.get('/orders/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const order = await ordersCollection.findOne(query);
        res.send(order);
    })

        app.post('/orders', async(req, res) =>{
        const orders = req.body;
        const result = await ordersCollection.insertOne(orders);
        res.send(result);
        });
       
        app.get('/users', async (req, res) => {
            const query = {};
            console.log(query)
            const users = await usersCollection.find(query).toArray();
            // console.log(users);
            res.send(users);
        });


        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        app.post('/users', async(req, res) =>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // admin role......

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.put('/users/admin/:id', verifyJWT, async(req, res) =>{
        const decodedEmail = req.decoded.email;
        const query = {email: decodedEmail};
        const user = await usersCollection.findOne(query);
        if(user?.role !== 'admin'){
         return res.status(403).send({message: 'forbidden access'})
        }
        
          const id = req.params.id;
          const filter = {_id: ObjectId(id)};
          const options = {upsert: true};
          const updatedDoc = {
            $set:{
                role: 'admin'
            }
          }
          const result = await usersCollection.updateOne(filter,updatedDoc,options);
          res.send(result);
        });

        // seller role..........

        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });

        // delete user

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter);
            res.send(result)
        });


        // payment..................
        
        app.post('/create-payment-intent', async(req,res) =>{
            const order = req.body;
            const resaleprice = order.resaleprice;
            const amount = resaleprice * 100;

            const paymentIntent = await stripe.paymentIntents.create({
              
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
              });

        })
        


        
    }
    finally {

    }
}

run().catch(err => console.log(err))

app.get('/', async (req, res) => {
    res.send('Cars Portal server is running ')
})

app.listen(port, () => {
    console.log(`Cars Portal running on ${port}`)
})