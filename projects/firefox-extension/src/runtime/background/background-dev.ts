import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initBackground } from "./init-background";

const auth = initInMemoryAuth();
const readingList = initInMemoryReadingList();

initBackground({ auth, readingList });
