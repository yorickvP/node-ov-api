import requestPromise from "request-promise";

import x from "./throw-if-missing";


const normalize_time = (t) => new Date((t / 1000 | 0) * 1000);
const normalize_record_time = (data) => Object.assign(data, {
	transactionDateTime: normalize_time(data.transactionDateTime)
});


/**
 * Author: Bart0110. <br>
 * This library can be used to access basic data from the OV-chipcard network in the Netherlands.
 */
export default class OVApi {

	/** Creates an instance of OVApi.
	 * @param {String} username - Username used to access ov-chipkaart.nl. This field is required.
	 * @param {String} password - Password used to access ov-chipkaart.nl. This field is required.
	 * @param {String} [clientId=nmOIiEJO5khvtLBK9xad3UkkS8Ua] - Special client identifier used to access ov-chipkaart.nl.
	 * @param {String} [clientSecret=FE8ef6bVBiyN0NeyUJ5VOWdelvQa] - Special client secret bound to the client identifier.
	 */
	constructor(username = x('Username'), password = x('Password'), clientId = "nmOIiEJO5khvtLBK9xad3UkkS8Ua", clientSecret = "FE8ef6bVBiyN0NeyUJ5VOWdelvQa") {
		/**
		 * The client identifier.
		 * @type {String}
		 * @private
		 */
		this._clientId = clientId;

		/**
		 * The client secret.
		 * @type {String}
		 * @private
		 */
		this._clientSecret = clientSecret;

		/**
		 * The username.
		 * @type {String}
		 * @private
		 */
		this._username = username;

		/**
		 * The password.
		 * @type {String}
		 * @private
		 */
		this._password = password;

		/**
		 * Token from logging into ov-chipkaart.nl. Note: this token is not authorized to do actions like fetching transactions.
		 * @type {(String|null)}
		 * @private
		 */
		this._loginToken = null;

		/**
		 * The refresh token is used to refresh the 'main' token for accesing ov-chipkaart.nl.
		 * @type {(String|null)}
		 * @private
		 */
		this._refreshToken = null;

		/**
		 * This token is authorized with the login token. This token is used to perform actions like fetching transactions.
		 * @type {(String|null)}
		 * @private
		 * @see {@link _loginToken}
		 */
		this._dataToken = null;

		/**
		 * As of now it does nothing. This is reserverd in case we need to use it.
		 * @type {(String|null)}
		 * @private
		 */
		this._accessToken = null;

		/**
		 * At the moment the date the login token will expire.
		 * @type {(Date|null)}
		 * @private
		 */
		this._expireDate = null;

		/**
		 * This object holds all the attached cards to the account.
		 * @type {(JSON|null)}
		 * @private
		 */
		this._cards = null;

		/**
		 * Endpoint used to get an access token.
		 * @type {String}
		 * @private
		 */
		this._loginEndpoint = 'https://login.ov-chipkaart.nl/oauth2/token';

		/**
		 * Endpoint used to perform certain actions.
		 * @type {String}
		 * @private
		 * @see {@link getCards}
		 * @see {@link getTransactions}
		 */
		this._actionEndpoint = 'https://api2.ov-chipkaart.nl/femobilegateway/v1';

		return this;
	}

	/**
	 * Make a request to the oauth url
	 * @param {Object} form - Parameters to pass to the url.
	 * @return {Promise} - Resolve returns token used to create data token. Reject contains an error message that occured.
	 */
	_oAuthRequest(form) {
		return requestPromise({
			method: 'POST',
			uri: this._loginEndpoint,
			form,
		}).then((body) => {
			body = JSON.parse(body);

			this._loginToken = body['id_token'];
			this._refreshToken = body['refresh_token'];
			this._accessToken = body['access_token'];
			this._expireDate = new Date(Date.now() + (body['expires_in'] * 1000));
			return this._loginToken;
		}).catch((error) => {
			throw ({
				htmlCode: error['statusCode'],
				body: JSON.parse(error['response']['body'])
			});
		});
	}


	/**
	 * Login into ov-chipkaart.nl.
	 * @return {Promise} - Resolve returns token used to create data token. Reject returns an error message that occured while logging in.
	 */
	_login() {
		if (new Date() < this._expireDate && this.loginToken != null)
			return Promise.resolve(this._loginToken);

		return this._oAuthRequest({
			client_id: this._clientId,
			client_secret: this._clientSecret,
			username: this._username,
			password: this._password,
			grant_type: "password",
			scope: "openid"
		});
	}

	/**
	 * Create data token. This method automatically logs you in if you haven't called login()
	 * @return {Promise} - Resolve returns token used to access data. Reject returns an error message that occured while fetching the token.
	 * @see {@link _login}
	 */
	authorize() {
		return this._login().then((authenticationToken) => {
			return this._tlsRequest('api/authorize', {authenticationToken});
		}).then(token => {
			this._dataToken = token;
			return token;
		});
	}

	/**
	 * Refresh access token.
	 * @return {Promise} - Resolve returns token used to create data token. Reject returns an error message that occured while refreshing the token.
	 */
	refreshToken() {
		// if (new Date() < this._expireDate && this._loginToken != null)
		// 	return Promise.resolve(this._loginToken);

		return this._oAuthRequest({
			client_id: this._clientId,
			client_secret: this._clientSecret,
			refresh_token: this._refreshToken,
			grant_type: "refresh_token"
		});
	}

	/**
	 * Make a request to the tls API
	 * @param {String} endpoint - API endpoint to call. This field is required.
	 * @param {Object} [form={}] - Parameters to submit.
	 * @return {Promise} - Resolve returns api response. Reject contains an error message if the API returned a failure or the API request failed.
	 *
	 */
	_tlsRequest(endpoint = x('endpoint'), form = {}) {
		return requestPromise({
			method: 'POST',
			uri: `${this._actionEndpoint}/${endpoint}`,
			form: Object.assign({
				authorizationToken: this._dataToken,
			}, form)
		}).then(body => {
			const {c,o,e} = JSON.parse(body);
			if (c !== 200) {
				throw new Error("TLS returned error code " + c, e);
			}
			return o;
		});
	}

	/**
	 * Get all attached cards to the account.
	 * @return {Promise} - Resolve returns all cards attached to the account. Reject returns an error message that occured while fetching the cards.
	 */
	getCards() {
		return this._tlsRequest('cards/list');
	}


	/**
	 * Get transactions with optional parameters.
	 * @param {Number} mediumId - Unique card id. You can pull this from getCards(). This field is required.
	 * @param {Object} NRC the 'nextRequestContext' used to get more data.
	 * @return {Promise} - Resolve returns transactions. Reject returns an error message that occured while fetching the transactions.
	 * @see {@link getCards}
	 */
	getTransactionsNRC(mediumId = x('MediumId'), nrc = {}) {
		return this._tlsRequest("transactions", Object.assign({mediumId}, nrc))
			.then(o => Object.assign(o, {
				records: o.records.map(normalize_record_time),
				continuation: () => this.getTransactionsNRC(mediumId, o['nextRequestContext'])
			}));
	}

	/**
	 * Get transactions between two dates.
	 * @param {Number} mediumId - Unique card id. You can pull this from getCards(). This field is required.
	 * @param {String} [startDate=current_date] - The date were the server should start looking. Correct syntax = `YYYY-MM-DD`.
	 * @param {String} [endDate=current_date] - The date were the server should stop looking. Correct syntax = `YYYY-MM-DD`.
	 * @param {Number} [offset=0] - How many records the server should skip.
	 * @return {Promise} - Resolve returns transactions. Reject returns an error message that occured while fetching the transactions.
	 * @see {@link getCards}
	 */
	getTransactions(mediumId = x('MediumId'), startDate = (new Date().toISOString().slice(0, 10)),
				   endDate = (new Date().toISOString().slice(0, 10)), offset = 0) {
		return this.getTransactionsNRC(mediumId, {offset, startDate, endDate});
	}

	/**
	 * Get detailed card info such as: balance, when the balance was last updated, auto reload information and the date when the card expires.
	 * @param {Number} mediumId - Unique card id. You can pull this from getCards(). This field is required.
	 * @return {Promise} - Resolve returns detailed information about the card. Reject returns an error message that occured while fetching the transactions.
	 * @see {@link getCards}
	 */
	getDetailedCardInfo(mediumId = x('MediumId')) {
		return this._tlsRequest("card/", {mediumId});
	}
}
