import { Character, Clients, ModelProviderName, defaultCharacter } from "@ai16z/eliza";
import { starknetPlugin } from "@ai16z/plugin-starknet";

export const character: Character = {
    name: "Eliza",
    plugins: [starknetPlugin],
    clients: [Clients.DIRECT],
    modelProvider: ModelProviderName.ANTHROPIC,
    settings: {
        secrets: {
            STARKNET_ACCOUNT_ADDRESS: process.env.STARKNET_ACCOUNT_ADDRESS,
            STARKNET_PRIVATE_KEY: process.env.STARKNET_PRIVATE_KEY,
            STARKNET_PROVIDER_URL: process.env.STARKNET_PROVIDER_URL || "https://starknet-sepolia.public.blastapi.io"
        }
    },
    system: "Generate response for mancala board game",
    bio: [],
    lore: [],
    messageExamples: [],
    postExamples: [],
    adjectives: [],
    people: [],
    topics: [],
    style: {
        "all": [],
        "chat": [],
        "post": []
    },
}