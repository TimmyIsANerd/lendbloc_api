import {TatumSDK, type AddressBalance, type ResponseDto} from '@tatumio/tatum';
import { mapToTatumNetwork } from './rates';


export async function getWalletBalance(networkKey: string, walletAddress: string){
    try {
        const network = mapToTatumNetwork(networkKey)
        const tatum = await TatumSDK.init({ network })
        
        const balance: ResponseDto<AddressBalance[]> = await tatum.address.getBalance({
            addresses: [walletAddress], 
            pageSize:20,
        })
        return balance.data
    } catch (error) {
        console.error(`Error getting wallet balance for ${walletAddress} on network ${networkKey}:`, error)
        throw error
    }
}