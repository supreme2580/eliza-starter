import {
    type Action,
    ActionExample,
    composeContext,
    Content,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import { getStarknetAccount, getStarknetProvider } from "../utils/index.js";
import { validateStarknetConfig } from "../environment.js";
import { Contract } from "starknet";

export interface MoveGameContent extends Content {
    gameId: string;
    selectedPit: number;
    opponentPits: number[];
    opponentMancala: number;
}

export function isMoveGameContent(
    content: MoveGameContent
): content is MoveGameContent {
    return (
        typeof content.gameId === "string" &&
        typeof content.selectedPit === "number" &&
        Array.isArray(content.opponentPits) &&
        content.opponentPits.length === 6 &&
        typeof content.opponentMancala === "number"
    );
}

const moveGameTemplate = `Respond with a JSON markdown block containing the extracted game information and your strategic pit selection. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "gameId": "0x123...",
    "selectedPit": 3,
    "opponentPits": [4,4,4,4,4,4],
    "opponentMancala": 10
}
\`\`\`

{{recentMessages}}

Important Mancala Rules to Consider:
1. Distribution Rules:
   - Seeds are distributed counter-clockwise, one in each pit
   - Skip opponent's Mancala (pit 7) during distribution
   - If last seed lands in your Mancala, you get another turn
   - If last seed lands in an empty pit on your side, capture opposite pit's seeds

2. Capture Logic:
   - When last seed lands in empty pit on your side
   - You capture all seeds from opponent's opposite pit
   - Both captured seeds and capturing seed go to your Mancala
   - Can only capture if opposite pit has seeds

3. Game End:
   - Game ends when all pits on one side are empty
   - Remaining seeds go to owner's Mancala

Strategic Considerations:
1. Prioritize moves that:
   - Land in your Mancala for extra turns
   - Create capture opportunities
   - Protect your seeds from captures
2. Avoid moves that:
   - Leave your pits vulnerable to captures
   - Distribute seeds to opponent's strong positions

Given the recent messages about the Mancala game state:
1. Extract the game ID
2. Extract opponent's pit values
3. Extract opponent's mancala value
4. Analyze the position considering above rules
5. Select best pit to move from (1-6)

Respond with a JSON markdown block containing the game state and your selected move.`;

const CONTRACT_ADDRESS = "0x073d5f249b9519777bcca407e74b7230c935abded8b1f21717f75a5a8ce962a5";

export default {
    name: "MOVE_GAME",
    similes: ["MAKE_MOVE", "PLAY_MOVE", "SELECT_PIT"],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        await validateStarknetConfig(runtime);
        return true;
    },
    description: "Use this action when it's your turn to make a move in a Mancala game.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting MOVE_GAME handler...");

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: moveGameTemplate,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context,
            modelClass: ModelClass.MEDIUM,
        });

        elizaLogger.debug("Move game content:", content);

        if (!isMoveGameContent(content)) {
            elizaLogger.error("Invalid content for MOVE_GAME action.");
            if (callback) {
                callback({
                    text: "Could not determine game state or select a valid move. Please provide game ID and current board state.",
                    content: { error: "Invalid move content" },
                });
            }
            return false;
        }

        try {
            const provider = getStarknetProvider(runtime);
            const account = getStarknetAccount(runtime);

            // Get contract ABI
            const { abi } = await provider.getClassAt(CONTRACT_ADDRESS);
            if (!abi) {
                throw new Error("Contract ABI not found");
            }

            // Create contract instance
            const contract = new Contract(abi, CONTRACT_ADDRESS, provider);
            contract.connect(account);

            // Execute move function
            const tx = await contract.invoke("move", [content.gameId, content.selectedPit]);

            elizaLogger.success(
                `Successfully made move on pit ${content.selectedPit} in game ${content.gameId}! tx: ${tx.transaction_hash}`
            );
            
            if (callback) {
                callback({
                    text: `I've selected pit ${content.selectedPit} for my move. Transaction hash: ${tx.transaction_hash}`,
                    content: {
                        success: true,
                        txHash: tx.transaction_hash,
                        gameId: content.gameId,
                        selectedPit: content.selectedPit,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error making move:", error);
            if (callback) {
                callback({
                    text: `Error making move: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "It's your turn in game 0x123. Opponent's pits are [4,4,4,4,4,4] with 10 in mancala",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll analyze the position and make a strategic move from pit 3.",
                },
            },
        ],
    ] as ActionExample[][],
} as Action; 