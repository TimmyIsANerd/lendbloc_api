import User from '../../models/User';
import Transaction, { type ITransaction } from '../../models/Transaction';



export const updateDeposit = async ({
    userId,
    amount,
    asset,
    txHash
}: {
    userId: string,
    amount: number;
    asset: string;
    status: string;
    txHash: string;
}) => {
    // Create New Tx Deposit
    try {
        // Confirm No Tx with TxHash exists
        const tx = await Transaction.findOne({ txHash });

        if (tx) {
            console.log("Transaction already exists")
            throw Error("Transaction already exists")
        }

        const newTx = await Transaction.create({
            user: userId,
            type: 'deposit',
            amount,
            asset,
            txHash
        })


    } catch (error: any) {
        console.log(error)
        throw Error(error)
    }
}


export const confirmDeposit = async (txId: string) => {
    // Find Tx
    try {
        const tx = await Transaction.findById(txId);

    } catch (error) {

    }
}

export const updateWithdrawal = async () => {

}