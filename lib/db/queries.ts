import "server-only";

import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdminApp } from "../firebaseAdmin";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";

function getDb() {
  return getFirestore(firebaseAdminApp);
}

import {
  type Chat,
  type DBMessage,
  type Document,
  type Stream,
  type Suggestion,
  type User,
  type Vote,
} from "./schema";

import type { VisibilityType } from "@/components/chat/visibility-selector";

export async function getUser(email: string): Promise<User[]> {
  try {
    const snapshot = await getDb()
      .collection("users")
      .where("email", "==", email)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as User;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const { generateHashedPassword } = require("./utils");
  const hashedPassword = generateHashedPassword(password);
  const id = generateUUID();

  try {
    const userData = {
      email,
      password: hashedPassword,
      isAnonymous: false,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await getDb().collection("users").doc(id).set(userData);
    return [{ id, ...userData }];
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const { generateHashedPassword } = require("./utils");
  const id = generateUUID();
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    const userData = {
      email,
      password,
      isAnonymous: true,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await getDb().collection("users").doc(id).set(userData);
    return [{ id, email: userData.email }];
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await getDb().collection("chats").doc(id).set({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    // Delete votes
    const votesSnapshot = await getDb()
      .collection("votes")
      .where("chatId", "==", id)
      .get();
    const batch = getDb().batch();
    votesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete messages
    const messagesSnapshot = await getDb()
      .collection("messages")
      .where("chatId", "==", id)
      .get();
    messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete streams
    const streamsSnapshot = await getDb()
      .collection("streams")
      .where("chatId", "==", id)
      .get();
    streamsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete chat
    const chatRef = getDb().collection("chats").doc(id);
    const chatDoc = await chatRef.get();
    batch.delete(chatRef);

    await batch.commit();
    return chatDoc.data();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const chatsSnapshot = await getDb()
      .collection("chats")
      .where("userId", "==", userId)
      .get();

    if (chatsSnapshot.empty) {
      return { deletedCount: 0 };
    }

    const chatIds = chatsSnapshot.docs.map((doc) => doc.id);
    const batch = getDb().batch();

    // Iterate over chatIds and delete associated data
    // Note: Firestore batch limit is 500 operations. If many chats, this might need chunking.
    for (const chatId of chatIds) {
      const votes = await getDb()
        .collection("votes")
        .where("chatId", "==", chatId)
        .get();
      votes.docs.forEach((doc) => batch.delete(doc.ref));

      const messages = await getDb()
        .collection("messages")
        .where("chatId", "==", chatId)
        .get();
      messages.docs.forEach((doc) => batch.delete(doc.ref));

      const streams = await getDb()
        .collection("streams")
        .where("chatId", "==", chatId)
        .get();
      streams.docs.forEach((doc) => batch.delete(doc.ref));

      batch.delete(getDb().collection("chats").doc(chatId));
    }

    await batch.commit();
    return { deletedCount: chatIds.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    let query = getDb()
      .collection("chats")
      .where("userId", "==", id)
      .orderBy("createdAt", "desc");

    if (startingAfter) {
      const doc = await getDb().collection("chats").doc(startingAfter).get();
      if (doc.exists) {
        query = query.startAfter(doc);
      }
    } else if (endingBefore) {
      const doc = await getDb().collection("chats").doc(endingBefore).get();
      if (doc.exists) {
        query = query.endBefore(doc);
      }
    }

    const snapshot = await query.limit(limit + 1).get();
    const chats = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
      } as Chat;
    });

    const hasMore = chats.length > limit;
    return {
      chats: hasMore ? chats.slice(0, limit) : chats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const doc = await getDb().collection("chats").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      ...data,
      createdAt: data?.createdAt.toDate(),
    } as Chat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    const batch = getDb().batch();
    messages.forEach((msg) => {
      const ref = getDb().collection("messages").doc(msg.id || generateUUID());
      batch.set(ref, {
        ...msg,
        createdAt: msg.createdAt || new Date(),
      });
    });
    return await batch.commit();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: any;
}) {
  try {
    return await getDb().collection("messages").doc(id).update({ parts });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    const snapshot = await getDb()
      .collection("messages")
      .where("chatId", "==", id)
      .orderBy("createdAt", "asc")
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
      } as DBMessage;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const voteId = `${chatId}_${messageId}`;
    return await getDb().collection("votes").doc(voteId).set({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }): Promise<Vote[]> {
  try {
    const snapshot = await getDb()
      .collection("votes")
      .where("chatId", "==", id)
      .get();
    return snapshot.docs.map((doc) => doc.data() as Vote);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: Document["kind"];
  content: string;
  userId: string;
}) {
  try {
    const data = {
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    };
    // Use a composite ID if needed, but here id is usually a UUID
    await getDb().collection("documents").doc(`${id}_${Date.now()}`).set(data);
    return [data];
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const snapshot = await getDb()
      .collection("documents")
      .where("id", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({ content });
    return [{ ...doc.data(), content }];
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }): Promise<Document[]> {
  try {
    const snapshot = await getDb()
      .collection("documents")
      .where("id", "==", id)
      .orderBy("createdAt", "asc")
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
      } as Document;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }): Promise<Document | null> {
  try {
    const snapshot = await getDb()
      .collection("documents")
      .where("id", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return {
      ...data,
      createdAt: data.createdAt.toDate(),
    } as Document;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    const suggestionsSnapshot = await getDb()
      .collection("suggestions")
      .where("documentId", "==", id)
      .where("documentCreatedAt", ">", timestamp)
      .get();
    const batch = getDb().batch();
    suggestionsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const docsSnapshot = await getDb()
      .collection("documents")
      .where("id", "==", id)
      .where("createdAt", ">", timestamp)
      .get();
    const deletedDocs: any[] = [];
    docsSnapshot.docs.forEach((doc) => {
      deletedDocs.push(doc.data());
      batch.delete(doc.ref);
    });

    await batch.commit();
    return deletedDocs;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    const batch = getDb().batch();
    suggestions.forEach((s) => {
      const ref = getDb().collection("suggestions").doc(s.id || generateUUID());
      batch.set(ref, {
        ...s,
        createdAt: s.createdAt || new Date(),
        documentCreatedAt: s.documentCreatedAt,
      });
    });
    await batch.commit();
    return suggestions;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}): Promise<Suggestion[]> {
  try {
    const snapshot = await getDb()
      .collection("suggestions")
      .where("documentId", "==", documentId)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
        documentCreatedAt: data.documentCreatedAt.toDate(),
      } as Suggestion;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }): Promise<DBMessage[]> {
  try {
    const doc = await getDb().collection("messages").doc(id).get();
    if (!doc.exists) return [];
    const data = doc.data();
    return [
      {
        ...data,
        id: doc.id,
        createdAt: data?.createdAt.toDate(),
      } as DBMessage,
    ];
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const snapshot = await getDb()
      .collection("messages")
      .where("chatId", "==", chatId)
      .where("createdAt", ">=", timestamp)
      .get();

    if (snapshot.empty) return;

    const messageIds = snapshot.docs.map((doc) => doc.id);
    const batch = getDb().batch();

    for (const msgId of messageIds) {
      const votes = await getDb()
        .collection("votes")
        .where("chatId", "==", chatId)
        .where("messageId", "==", msgId)
        .get();
      votes.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(getDb().collection("messages").doc(msgId));
    }

    return await batch.commit();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await getDb()
      .collection("chats")
      .doc(chatId)
      .update({ visibility });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await getDb().collection("chats").doc(chatId).update({ title });
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    // Firestore doesn't support joins, so we need to query chats for the user and then messages for those chats.
    // This could be expensive. If performance is an issue, we should denormalize.
    const chatsSnapshot = await getDb()
      .collection("chats")
      .where("userId", "==", id)
      .get();
    const chatIds = chatsSnapshot.docs.map((doc) => doc.id);

    if (chatIds.length === 0) return 0;

    let totalCount = 0;
    // Firestore IN query limited to 10-30 items depending on library. 
    // We'll query in chunks if needed or just iterate.
    for (const chatId of chatIds) {
      const msgSnapshot = await getDb()
        .collection("messages")
        .where("chatId", "==", chatId)
        .where("createdAt", ">=", cutoffTime)
        .where("role", "==", "user")
        .get();
      totalCount += msgSnapshot.size;
    }

    return totalCount;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await getDb()
      .collection("streams")
      .doc(streamId)
      .set({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const snapshot = await getDb()
      .collection("streams")
      .where("chatId", "==", chatId)
      .orderBy("createdAt", "asc")
      .get();
    return snapshot.docs.map((doc) => doc.id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}
