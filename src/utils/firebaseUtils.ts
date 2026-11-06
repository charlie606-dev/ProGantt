import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, query, where, Timestamp, writeBatch, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Task, Project } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const convertTaskToFirestore = (task: Task, userId: string, projectId: string) => {
  const data: any = {
    ...task,
    start: Timestamp.fromDate(task.start),
    end: Timestamp.fromDate(task.end),
    userId,
    projectId,
  };
  
  // Remove undefined values as Firestore doesn't support them
  Object.keys(data).forEach(key => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });
  
  return data;
};

export const convertFirestoreToTask = (doc: any): Task => {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    start: data.start.toDate(),
    end: data.end.toDate(),
  } as Task;
};

export const fetchProjectsFromFirestore = async (userId: string): Promise<Project[]> => {
  const path = `users/${userId}/projects`;
  try {
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const subscribeToProjects = (userId: string, callback: (projects: Project[]) => void, onError: (error: Error) => void) => {
  const path = `users/${userId}/projects`;
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
    callback(projects);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch (e) {
      onError(e as Error);
    }
  });
};

export const saveProjectToFirestore = async (userId: string, project: Project) => {
  const path = `users/${userId}/projects`;
  const projectRef = doc(db, path, project.id);
  try {
    await setDoc(projectRef, { ...project, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteProjectFromFirestore = async (userId: string, projectId: string) => {
  const path = `users/${userId}/projects`;
  const projectRef = doc(db, path, projectId);
  const tasksPath = `users/${userId}/projects/${projectId}/tasks`;
  
  try {
    // Delete all tasks in the subcollection first
    const tasksSnapshot = await getDocs(collection(db, tasksPath));
    const batch = writeBatch(db);
    tasksSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Then delete the project document
    await deleteDoc(projectRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const fetchTasksFromFirestore = async (userId: string, projectId: string): Promise<Task[]> => {
  const path = `users/${userId}/projects/${projectId}/tasks`;
  try {
    const q = query(collection(db, path));
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(convertFirestoreToTask);
    tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return tasks;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return []; // Fallback, though handleFirestoreError throws
  }
};

export const syncTasksToFirestore = async (userId: string, projectId: string, tasks: Task[]) => {
  const path = `users/${userId}/projects/${projectId}/tasks`;
  try {
    const tasksRef = collection(db, path);
    const snapshot = await getDocs(tasksRef);
    
    const batch = writeBatch(db);
    
    // Delete tasks that are no longer in the current list
    const newTaskIds = new Set(tasks.map(t => t.id));
    snapshot.docs.forEach(doc => {
      if (!newTaskIds.has(doc.id)) {
        batch.delete(doc.ref);
      }
    });

    // Set/Update current tasks
    tasks.forEach((task, index) => {
      const taskRef = doc(db, path, task.id);
      batch.set(taskRef, convertTaskToFirestore({ ...task, order: index }, userId, projectId));
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToTasks = (userId: string, projectId: string, callback: (tasks: Task[]) => void, onError: (error: Error) => void) => {
  const path = `users/${userId}/projects/${projectId}/tasks`;
  const q = query(collection(db, path));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(convertFirestoreToTask);
    tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    callback(tasks);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch (e) {
      onError(e as Error);
    }
  });
};

export const saveTaskToFirestore = async (userId: string, projectId: string, task: Task) => {
  const path = `users/${userId}/projects/${projectId}/tasks`;
  const taskRef = doc(db, path, task.id);
  try {
    await setDoc(taskRef, convertTaskToFirestore(task, userId, projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const saveTasksToFirestore = async (userId: string, projectId: string, tasks: Task[]) => {
  const path = `users/${userId}/projects/${projectId}/tasks`;
  const batch = writeBatch(db);
  tasks.forEach((task, index) => {
    const taskRef = doc(db, path, task.id);
    batch.set(taskRef, convertTaskToFirestore({ ...task, order: index }, userId, projectId));
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteTaskFromFirestore = async (userId: string, projectId: string, taskId: string) => {
  const path = `users/${userId}/projects/${projectId}/tasks`;
  const taskRef = doc(db, path, taskId);
  try {
    await deleteDoc(taskRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
