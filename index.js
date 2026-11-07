const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 5001

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(express.json());
const allowedOrigins = ['http://localhost:3000',"http://172.20.10.4:3000"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}));



// Controllers
const authController = require('./controllers/authControllers');
const itemController = require('./controllers/itemController');
const registrationController = require('./controllers/registrationController');
const salesController = require('./controllers/salesController');
const clientsController = require('./controllers/clientsController');
const financesController = require('./controllers/financesController');
const invoiceController = require('./controllers/invoiceController');
const creditorsController = require('./controllers/creditorsController');
const laboratoryController = require('./controllers/laboratoryController');
const transferController = require('./controllers/transferController');
const totBitController = require('./controllers/totBitController');
const qzController = require('./controllers/qzController');
const syncController = require('./controllers/syncController');
//middleware
const authMiddleware = require('./middleware/authMiddleware');

// Routes
app.post('/login', authController.loginUser);
app.post('/logout', authMiddleware, authController.logoutUser);
app.post('/create-payment',authController.createPayment)

app.get('/registeredusers',registrationController.getUsers);
app.get('/registration/:id',registrationController.getUserById);
app.post('/registration',registrationController.registerUser);
app.post('/resetPassword', registrationController.resetPassword);
app.post("/requestPassword", registrationController.requestPasswordReset);
app.put('/registration/:id',registrationController.updateUser);
app.delete('/registration/:id',registrationController.deleteUser);

app.get('/finances',financesController.getAllTransactions);
app.get('/finances/:id',financesController.getTransactionById);
app.post('/finances',financesController.createTransaction);
app.put('/finances/:id',financesController.updateTransaction);
app.delete('/finances/:id',financesController.deleteTransaction);
app.get('/finaces/type/:type', financesController.getTransactionsByType); 

app.post('/sale', salesController.createSale);
app.get('/sale', salesController.getAllSales);
app.get('/creditsale', salesController.getAllCreditSales);
app.get('/creditsale/:id', salesController.getCreditSaleById);
app.put('/creditsale/:id', salesController.updateCreditSale);
app.delete('/creditsale/:id', salesController.deleteCreditSale);
app.put('/editsales', salesController.updateSaleAfterReturn);
app.get('/dialysales', salesController.getDailySalesTotals)
app.post('/addaftersale', salesController.addProductToExistingReceipt);
// QZ Tray certificate/signing routes
app.get('/qz/certificate', qzController.getQzCertificate);
app.post('/qz/sign',express.text({ type: '*/*' }),qzController.signQzRequest);

// Sync routes (offline <-> server)
app.post('/sync/register-client', authMiddleware, syncController.registerClient);
app.post('/sync/push',            authMiddleware, syncController.pushChanges);
app.post('/sync/push-receipt',    authMiddleware, syncController.pushReceipt); // <--- ADDED THIS
app.get('/sync/pull',             authMiddleware, syncController.pullChanges);

app.get('/product', itemController.getAllProducts);
app.get('/product/:id', itemController.getProductById);
app.post('/product', itemController.createProduct);
app.put('/product/:id', itemController.updateProduct);
app.delete('/product/:id', itemController.deleteProduct);
app.get('/expired', itemController.getAlerts);

app.get('/clients', clientsController.getAllClients);
app.get('/clients/:id', clientsController.getClientById);
app.post('/clients', clientsController.createClient);
app.put('/clients/:id', clientsController.updateClient);
app.delete('/clients/:id', clientsController.deleteClient);

app.get('/invoice', invoiceController.getAllInvoices);
app.get('/invoice/:id', invoiceController.getInvoiceById);
app.post('/invoice', invoiceController.createInvoice);
app.put('/invoice/:id', invoiceController.updateInvoice);
app.delete('/invoice/:id', invoiceController.deleteInvoice);

app.get('/creditors', creditorsController.getAllCreditors);         
app.get('/creditors/:id', creditorsController.getCreditorById);     
app.post('/creditors', creditorsController.createCreditor);         
app.put('/creditors/:id', creditorsController.updateCreditor);      
app.delete('/creditors/:id', creditorsController.deleteCreditor);

app.get('/laboratory', laboratoryController.getAllLabResults);
app.get('/laboratory/:id', laboratoryController.getLabResultsById);
app.post('/laboratory', laboratoryController.createlaboratory);
app.put('/laboratory/:id', laboratoryController.updateLabResults);
app.delete('/laboratory/:id', laboratoryController.deleteLabResults); 

app.get('/transfer', transferController.getAllTransfer);
app.get('/shortages', transferController.getAllShortages);
app.post('/transfer', transferController.createTransfer);
app.put('/transfer/:id',transferController.editTransfer)

app.get('/totBit', totBitController.getAllTotBit);
app.post('/totBit', totBitController.createTotBit);



app.listen(5001, '0.0.0.0', () => {

    console.log('Server running on http://0.0.0.0:5001');
  });