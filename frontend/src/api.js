import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Vite proxy handles redirection to http://localhost:8000
    timeout: 2000,  // Reduced to 2 seconds for faster failure detection
});

// Request interceptor to add Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const loginUser = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData);
    return response.data;
}

export const registerUser = async (username, email, password) => {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
}

export const createWell = async (wellData) => {
    const response = await api.post('/wells/', wellData);
    return response.data;
}

export const endWell = async (wellId) => {
    const response = await api.put(`/wells/${wellId}/end`);
    return response.data;
}

export const getActiveWell = async () => {
    try {
        const response = await api.get('/wells/active');
        return response.data;
    } catch {
        return null;
    }
}

export const getRigData = async () => {
    try {
        const response = await api.get('/rig/latest');
        if (response.data && !response.data.error) return response.data;
        return null;
    } catch {
        return null;
    }
};

export const getRigHistory = async (range = '-5m') => {
    try {
        const response = await api.get(`/rig/history?range=${range}`);
        return response.data || [];
    } catch {
        return [];
    }
};

export const getRigSensors = async () => {
    try {
        const response = await api.get('/rig/sensors');
        return response.data || {};
    } catch {
        return {};
    }
};

export const getUsers = async () => {
    try {
        const response = await api.get('/auth/users');
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getEquipmentStatus = async () => {
    // Placeholder for equipment endpoint
    return null;
}

// ── WITSML Config ──────────────────────────────────────────
export const getWitsmlConfigs = async () => {
    const response = await api.get('/witsml-config/');
    return response.data;
}

export const getActiveWitsmlConfig = async () => {
    try {
        const response = await api.get('/witsml-config/active');
        return response.data;
    } catch {
        return null;
    }
}

export const getHealth = async () => {
    try {
        const response = await api.get('/health');
        return response.data;
    } catch {
        return { status: 'offline', live_mode: false };
    }
}

export const createWitsmlConfig = async (data) => {
    const response = await api.post('/witsml-config/', data);
    return response.data;
}

export const updateWitsmlConfig = async (id, data) => {
    const response = await api.put(`/witsml-config/${id}`, data);
    return response.data;
}

export const activateWitsmlConfig = async (id) => {
    const response = await api.put(`/witsml-config/${id}/activate`);
    return response.data;
}

export const deleteWitsmlConfig = async (id) => {
    const response = await api.delete(`/witsml-config/${id}`);
    return response.data;
}

export const bulkUpdateMappings = async (configId, mappings) => {
    const response = await api.put(`/witsml-config/${configId}/mappings/bulk`, mappings);
    return response.data;
}

export const testWitsmlConnection = async (data) => {
    const response = await api.post('/witsml-config/test', data);
    return response.data;
}

export const browseWitsmlWells = async (data) => {
    const response = await api.post('/witsml-config/browse/wells', data);
    return response.data;
}

export const browseWitsmlWellbores = async (data) => {
    const response = await api.post('/witsml-config/browse/wellbores', data);
    return response.data;
}

export const browseWitsmlLogs = async (data) => {
    const response = await api.post('/witsml-config/browse/logs', data);
    return response.data;
}

// ── Modbus Config ──────────────────────────────────────────
export const getModbusDevices = async () => {
    const response = await api.get('/modbus-config/');
    return response.data;
}

export const createModbusDevice = async (data) => {
    const response = await api.post('/modbus-config/', data);
    return response.data;
}

export const updateModbusDevice = async (id, data) => {
    const response = await api.put(`/modbus-config/${id}`, data);
    return response.data;
}

export const deleteModbusDevice = async (id) => {
    const response = await api.delete(`/modbus-config/${id}`);
    return response.data;
}

export const toggleModbusDevice = async (id) => {
    const response = await api.put(`/modbus-config/${id}/toggle`);
    return response.data;
}

export const bulkUpdateRegisters = async (deviceId, registers) => {
    const response = await api.put(`/modbus-config/${deviceId}/registers/bulk`, registers);
    return response.data;
}

// ── Live Trend / History ─────────────────────────────────────
export const getRigHistoryRange = async (start, stop) => {
    try {
        const response = await api.get(`/rig/history-range?start=${encodeURIComponent(start)}&stop=${encodeURIComponent(stop)}`);
        return response.data || [];
    } catch {
        return [];
    }
};

export const exportExcel = async (startDate, endDate, fields = null) => {
    try {
        let url = `/export/excel?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
        if (fields && fields.length > 0) {
            url += `&fields=${encodeURIComponent(fields.join(','))}`;
        }
        const token = localStorage.getItem('token');
        const response = await fetch(`/api${url}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `trend_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        return true;
    } catch (err) {
        console.error('Excel export error:', err);
        return false;
    }
};
