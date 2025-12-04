// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract AllergenTrackerFHE is SepoliaConfig {
    struct EncryptedEntry {
        uint256 id;
        euint32 encryptedFood;       // Encrypted food item
        euint32 encryptedSymptom;    // Encrypted symptom record
        euint32 encryptedSeverity;   // Encrypted severity level
        uint256 timestamp;
    }

    struct DecryptedEntry {
        string food;
        string symptom;
        string severity;
        bool isRevealed;
    }

    uint256 public entryCount;
    mapping(uint256 => EncryptedEntry) public encryptedEntries;
    mapping(uint256 => DecryptedEntry) public decryptedEntries;

    mapping(string => euint32) private encryptedSymptomCount;
    string[] private symptomList;

    mapping(uint256 => uint256) private requestToEntryId;

    event EntrySubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event EntryDecrypted(uint256 indexed id);

    modifier onlyReporter(uint256 entryId) {
        _;
    }

    /// @notice Submit encrypted food and symptom entry
    function submitEncryptedEntry(
        euint32 encryptedFood,
        euint32 encryptedSymptom,
        euint32 encryptedSeverity
    ) public {
        entryCount += 1;
        uint256 newId = entryCount;

        encryptedEntries[newId] = EncryptedEntry({
            id: newId,
            encryptedFood: encryptedFood,
            encryptedSymptom: encryptedSymptom,
            encryptedSeverity: encryptedSeverity,
            timestamp: block.timestamp
        });

        decryptedEntries[newId] = DecryptedEntry({
            food: "",
            symptom: "",
            severity: "",
            isRevealed: false
        });

        emit EntrySubmitted(newId, block.timestamp);
    }

    /// @notice Request decryption for analysis
    function requestEntryDecryption(uint256 entryId) public onlyReporter(entryId) {
        EncryptedEntry storage entry = encryptedEntries[entryId];
        require(!decryptedEntries[entryId].isRevealed, "Already decrypted");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(entry.encryptedFood);
        ciphertexts[1] = FHE.toBytes32(entry.encryptedSymptom);
        ciphertexts[2] = FHE.toBytes32(entry.encryptedSeverity);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptEntry.selector);
        requestToEntryId[reqId] = entryId;

        emit DecryptionRequested(entryId);
    }

    /// @notice Callback for decrypted entry
    function decryptEntry(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 entryId = requestToEntryId[requestId];
        require(entryId != 0, "Invalid request");

        EncryptedEntry storage eEntry = encryptedEntries[entryId];
        DecryptedEntry storage dEntry = decryptedEntries[entryId];
        require(!dEntry.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));

        dEntry.food = results[0];
        dEntry.symptom = results[1];
        dEntry.severity = results[2];
        dEntry.isRevealed = true;

        if (!FHE.isInitialized(encryptedSymptomCount[dEntry.symptom])) {
            encryptedSymptomCount[dEntry.symptom] = FHE.asEuint32(0);
            symptomList.push(dEntry.symptom);
        }
        encryptedSymptomCount[dEntry.symptom] = FHE.add(
            encryptedSymptomCount[dEntry.symptom],
            FHE.asEuint32(1)
        );

        emit EntryDecrypted(entryId);
    }

    /// @notice Get decrypted entry details
    function getDecryptedEntry(uint256 entryId) public view returns (
        string memory food,
        string memory symptom,
        string memory severity,
        bool isRevealed
    ) {
        DecryptedEntry storage r = decryptedEntries[entryId];
        return (r.food, r.symptom, r.severity, r.isRevealed);
    }

    /// @notice Get encrypted symptom count
    function getEncryptedSymptomCount(string memory symptom) public view returns (euint32) {
        return encryptedSymptomCount[symptom];
    }

    /// @notice Request symptom count decryption
    function requestSymptomCountDecryption(string memory symptom) public {
        euint32 count = encryptedSymptomCount[symptom];
        require(FHE.isInitialized(count), "Symptom not found");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptSymptomCount.selector);
        requestToEntryId[reqId] = bytes32ToUint(keccak256(abi.encodePacked(symptom)));
    }

    /// @notice Callback for decrypted symptom count
    function decryptSymptomCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 symptomHash = requestToEntryId[requestId];
        string memory symptom = getSymptomFromHash(symptomHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
    }

    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getSymptomFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < symptomList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(symptomList[i]))) == hash) {
                return symptomList[i];
            }
        }
        revert("Symptom not found");
    }
}
