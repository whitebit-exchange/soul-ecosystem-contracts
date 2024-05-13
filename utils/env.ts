export const getAddressFromEnv = (variable: string): string => {
    const address = process.env[variable];
    if ("string" !== typeof address) {
        throw new Error(`Missing environment variable ${variable}`);
    }

    if (!address.match(/^0x[0-9a-fA-F]{40}$/)) {
        throw new Error(`Invalid environment variable ${variable}, expected valid Ethereum address`);
    }

    return address;
}
