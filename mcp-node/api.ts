import axios from 'axios';

const API_URL = "http://localhost:3001/api/v1";
const API_KEY = "apikey4mcp";

const headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json',
};

export const getBalance = async (key: string, value: string) => {

    const body = {

        actionType: "get_account_balance",
        customerId: '77167d29-bf22-4996-aba0-65b10f159ee4',
        key,
        value,
        filters: {}

    }

    try {
        const response = await axios.post(`${API_URL}/mcp-gateway/data`, body, { headers });
        return response.data;
    } catch (error) {
        return null;
    }
};

export const listAccounts = async (key: string, value: string) => {

    const body = {

        actionType: "list_account",
        customerId: '77167d29-bf22-4996-aba0-65b10f159ee4',
        key,
        value,
        filters: {}

    }

    try {
        const response = await axios.post(`${API_URL}/mcp-gateway/data`, body, { headers });
        return response.data;
    } catch (error) {
        return null;
    }
};


export const getAccountDetail = async (key: string, value: string, filters: any = {}) => {

    const body = {

        actionType: "get_account_detail",
        customerId: '77167d29-bf22-4996-aba0-65b10f159ee4',
        key,
        value,
        filters: filters

    }

    try {
        const response = await axios.post(`${API_URL}/mcp-gateway/data`, body, { headers });
        return response.data;
    } catch (error) {
        return null;
    }
};