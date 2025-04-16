export const encryptMessage = async (message, publicKey) => {
    try {
        const response = await fetch('http://localhost/api/encrypt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: message,
                public_key: publicKey
            }),
        });

        if (!response.ok) {
            throw new Error('Encryption failed');
        }

        const data = await response.json();
        return data.encrypted_text;
    } catch (error) {
        console.error('Error encrypting message:', error);
        throw error;
    }
};

export const decryptMessage = async (encryptedMessage, privateKey) => {
    try {
        const response = await fetch('http://localhost/api/decrypt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                encrypted_text: encryptedMessage,
                private_key: privateKey
            }),
        });

        if (!response.ok) {
            throw new Error('Decryption failed');
        }

        const data = await response.json();
        return data.decrypted_text;
    } catch (error) {
        console.error('Error decrypting message:', error);
        throw error;
    }
}; 