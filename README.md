# OVApi

An NodeJS API wrapper for the OVChipkaart. 
You can use this wrapper to fetch:
- Your balance
- Cards
- Detailed card information
- Check in points
- Check out points

### Install:
First run ```npm install --save OVApi```

Than add ```const OVApi = require("ovchip-api")``` or ```import OVApi from "ovchip-api"``` 

### Examples:
```javascript
let instance = new OVApi(username, password);

instance.authorize().then(() => { //Logs the user in and makes sure the tokens are all set
	instance.getCards().then((results) => { //Get all the cards attached to the account
		instance.getTransaction(results[0]['mediumId']).then(console.log).catch(console.error) //Display all the transaction today
	}).catch(console.error) //Display errors
}).catch(console.error);
```

--------------------------------------------------------------------------------

**This project and the distribution of this project is not illegal, nor does it violate _any_ DMCA laws. 
The use of this project, however, may be illegal. 
The maintainers of this project do not condone the use of this project for anything illegal, in any state, region, country, or planet. 
_Please use at your own risk_.**

--------------------------------------------------------------------------------
