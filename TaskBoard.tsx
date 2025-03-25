import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { v4 as uuidv4 } from "uuid";
import { MdDelete } from "react-icons/md";
import supabase from "supabaseClient";

interface Task {
  id: string;
  content: string;
  list_id: string;
}

interface TaskList {
  id: string;
  title: string;
  tasks: Task[];
}

const TaskBoard: React.FC = () => {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);

  useEffect(() => {
    fetchTaskLists();
    const subscription = supabase
      .channel("task_board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        fetchTaskLists
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_lists" },
        fetchTaskLists
      )
      .subscribe();
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchTaskLists = async () => {
    const { data: lists, error } = await supabase
      .from("task_lists")
      .select("*, tasks(*)")
      .order("position", { referencedTable: "tasks", ascending: true }); // Ensure tasks are sorted

    if (!error) setTaskLists(lists || []);
  };

  const addTaskList = async () => {
    const title = prompt("Enter task list title:");
    if (!title) return;
    const newPosition = taskLists.length; // New list goes at the end
    await supabase
      .from("task_lists")
      .insert([{ id: uuidv4(), title, position: newPosition }]);
  };

  const deleteTaskList = async (list_id: string) => {
    await supabase.from("task_lists").delete().eq("id", list_id);
  };

  const addTask = async (list_id: string) => {
    const content = prompt("Enter task content:");
    if (!content) return;
    await supabase.from("tasks").insert([{ id: uuidv4(), content, list_id }]);
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
  };

  const onDragEnd = async (result: any) => {
    const { source, destination } = result;
    if (!destination) return;

    if (result.type === "list") {
      // Reorder task lists
      const updatedLists = [...taskLists];
      const [movedList] = updatedLists.splice(source.index, 1);
      updatedLists.splice(destination.index, 0, movedList);

      setTaskLists(updatedLists);

      // Update database
      for (let i = 0; i < updatedLists.length; i++) {
        await supabase
          .from("task_lists")
          .update({ position: i })
          .eq("id", updatedLists[i].id);
      }
    } else if (result.type === "task") {
      // Reorder tasks within a list
      const updatedLists = [...taskLists];
      const sourceList = updatedLists.find(
        (list) => list.id === source.droppableId
      );
      const destList = updatedLists.find(
        (list) => list.id === destination.droppableId
      );

      if (!sourceList || !destList) return;

      const [movedTask] = sourceList.tasks.splice(source.index, 1);
      destList.tasks.splice(destination.index, 0, movedTask);
      movedTask.list_id = destList.id;

      setTaskLists(updatedLists);

      // Update database
      for (let i = 0; i < destList.tasks.length; i++) {
        await supabase
          .from("tasks")
          .update({ position: i, list_id: destList.id })
          .eq("id", destList.tasks[i].id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <button
        onClick={addTaskList}
        className="mb-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Add New List
      </button>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="list" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex space-x-6 overflow-x-auto"
            >
              {taskLists.map((list, index) => (
                <Draggable key={list.id} draggableId={list.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="flex w-72 flex-col rounded-lg bg-white  shadow-lg"
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="mb-3 flex items-center justify-between p-4 hover:bg-blue-300"
                      >
                        <h2 className="text-lg font-semibold">{list.title}</h2>
                        <MdDelete
                          onClick={() => deleteTaskList(list.id)}
                          className="cursor-pointer text-red-600 hover:text-red-800"
                        />
                      </div>

                      <div className="h-52">
                        <Droppable droppableId={list.id} type="task">
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="m-1 mx-3 space-y-2"
                            >
                              {list.tasks.map((task, index) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id}
                                  index={index}
                                >
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="flex items-center justify-between rounded-lg bg-gray-200 p-2 hover:bg-gray-300"
                                    >
                                      {task.content}
                                      <MdDelete
                                        onClick={() => deleteTask(task.id)}
                                        className="cursor-pointer text-red-500 hover:text-red-700"
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>

                      <button
                        onClick={() => addTask(list.id)}
                        className="m-1 mx-3 my-2  rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
                      >
                        Add Task
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default TaskBoard;

// #####################################################################
// ##################### Fine working code below #######################
// #####################################################################

// import React, { useState, useEffect } from "react";
// import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
// import { v4 as uuidv4 } from "uuid";
// import { MdDelete } from "react-icons/md";
// import supabase from "supabaseClient";

// interface Task {
//   id: string;
//   content: string;
//   list_id: string;
// }

// interface TaskList {
//   id: string;
//   title: string;
//   tasks: Task[];
// }

// const TaskBoard: React.FC = () => {
//   const [taskLists, setTaskLists] = useState<TaskList[]>([]);

//   useEffect(() => {
//     fetchTaskLists();
//     const subscription = supabase
//       .channel("task_board")
//       .on(
//         "postgres_changes",
//         { event: "*", schema: "public", table: "tasks" },
//         fetchTaskLists
//       )
//       .on(
//         "postgres_changes",
//         { event: "*", schema: "public", table: "task_lists" },
//         fetchTaskLists
//       )
//       .subscribe();
//     return () => {
//       subscription.unsubscribe();
//     };
//   }, []);

//   const fetchTaskLists = async () => {
//     const { data: lists, error } = await supabase
//       .from("task_lists")
//       .select("*, tasks(*)");
//     if (!error) setTaskLists(lists || []);
//   };

//   const addTaskList = async () => {
//     const title = prompt("Enter task list title:");
//     if (!title) return;
//     await supabase.from("task_lists").insert([{ id: uuidv4(), title }]);
//   };

//   const deleteTaskList = async (list_id: string) => {
//     await supabase.from("task_lists").delete().eq("id", list_id);
//   };

//   const addTask = async (list_id: string) => {
//     const content = prompt("Enter task content:");
//     if (!content) return;
//     await supabase.from("tasks").insert([{ id: uuidv4(), content, list_id }]);
//   };

//   const deleteTask = async (taskId: string) => {
//     await supabase.from("tasks").delete().eq("id", taskId);
//   };

//   const onDragEnd = async (result: any) => {
//     const { source, destination } = result;
//     if (!destination) return;

//     const updatedLists = [...taskLists];
//     const sourceList = updatedLists.find(
//       (list) => list.id === source.droppableId
//     );
//     const destList = updatedLists.find(
//       (list) => list.id === destination.droppableId
//     );
//     if (!sourceList || !destList) return;

//     const [movedTask] = sourceList.tasks.splice(source.index, 1);
//     destList.tasks.splice(destination.index, 0, movedTask);
//     movedTask.list_id = destList.id;

//     setTaskLists(updatedLists);
//     await supabase
//       .from("tasks")
//       .update({ list_id: destList.id })
//       .eq("id", movedTask.id);
//   };

//   return (
//     <div className="p-4">
//       <button
//         onClick={addTaskList}
//         className="m-2 rounded bg-blue-500 p-2 text-white"
//       >
//         Add New List
//       </button>
//       <DragDropContext onDragEnd={onDragEnd}>
//         <Droppable droppableId="board" type="list" direction="horizontal">
//           {(provided) => (
//             <div
//               ref={provided.innerRef}
//               {...provided.droppableProps}
//               className="flex space-x-4"
//             >
//               {taskLists.map((list, index) => (
//                 <Draggable key={list.id} draggableId={list.id} index={index}>
//                   {(provided) => (
//                     <div
//                       ref={provided.innerRef}
//                       {...provided.draggableProps}
//                       className="w-64 rounded bg-gray-100 shadow-md"
//                     >
//                       <div
//                         {...provided.dragHandleProps}
//                         className="flex justify-between p-4 text-lg font-bold"
//                       >
//                         <h2>{list.title}</h2>
//                         <MdDelete
//                           onClick={() => deleteTaskList(list.id)}
//                           className="cursor-pointer text-red-500"
//                         />
//                       </div>
//                       <Droppable droppableId={list.id} type="task">
//                         {(provided) => (
//                           <div
//                             ref={provided.innerRef}
//                             {...provided.droppableProps}
//                             className="p-2"
//                           >
//                             {list.tasks.map((task, index) => (
//                               <Draggable
//                                 key={task.id}
//                                 draggableId={task.id}
//                                 index={index}
//                               >
//                                 {(provided) => (
//                                   <div
//                                     ref={provided.innerRef}
//                                     {...provided.draggableProps}
//                                     {...provided.dragHandleProps}
//                                     className="flex justify-between rounded bg-white p-2 shadow"
//                                   >
//                                     {task.content}
//                                     <MdDelete
//                                       onClick={() => deleteTask(task.id)}
//                                       className="cursor-pointer text-red-500"
//                                     />
//                                   </div>
//                                 )}
//                               </Draggable>
//                             ))}
//                             {provided.placeholder}
//                           </div>
//                         )}
//                       </Droppable>
//                       <button
//                         onClick={() => addTask(list.id)}
//                         className="m-2 rounded bg-blue-500 p-2 text-white"
//                       >
//                         Add Task
//                       </button>
//                     </div>
//                   )}
//                 </Draggable>
//               ))}
//               {provided.placeholder}
//             </div>
//           )}
//         </Droppable>
//       </DragDropContext>
//     </div>
//   );
// };

// export default TaskBoard;

// #####################################################################
// ##################### Fine working code below #######################
// #####################################################################

// import React, { useState } from "react";
// import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
// import { v4 as uuidv4 } from "uuid";
// import { MdDelete } from "react-icons/md";

// interface Task {
//   id: string;
//   content: string;
// }

// interface TaskList {
//   id: string;
//   title: string;
//   tasks: Task[];
// }

// const initialData: TaskList[] = [
//   {
//     id: "list-1",
//     title: "To Do",
//     tasks: [
//       { id: "task-1", content: "Task 1" },
//       { id: "task-2", content: "Task 2" },
//     ],
//   },
//   {
//     id: "list-2",
//     title: "In Progress",
//     tasks: [
//       { id: "task-3", content: "Task 3" },
//       { id: "task-4", content: "Task 4" },
//     ],
//   },
//   {
//     id: "list-5",
//     title: "To be check",
//     tasks: [{ id: "task-7", content: "Task 7" }],
//   },
//   {
//     id: "list-3",
//     title: "Done",
//     tasks: [{ id: "task-5", content: "Task 5" }],
//   },
//   {
//     id: "list-4",
//     title: "Archive",
//     tasks: [{ id: "task-6", content: "Task 6" }],
//   },
// ];

// const TaskBoard: React.FC = () => {
//   const [taskLists, setTaskLists] = useState<TaskList[]>(initialData);

//   const onDragEnd = (result: any) => {
//     const { source, destination, type } = result;
//     if (!destination) return;

//     // Dragging a list
//     if (type === "list") {
//       const newLists = Array.from(taskLists);
//       const [movedList] = newLists.splice(source.index, 1);
//       newLists.splice(destination.index, 0, movedList);
//       setTaskLists(newLists);
//       return;
//     }

//     // Dragging a task within or across lists
//     const sourceList = taskLists.find((list) => list.id === source.droppableId);
//     const destinationList = taskLists.find(
//       (list) => list.id === destination.droppableId
//     );

//     if (!sourceList || !destinationList) return;

//     const sourceTasks = Array.from(sourceList.tasks);
//     const [movedTask] = sourceTasks.splice(source.index, 1);

//     if (source.droppableId === destination.droppableId) {
//       sourceTasks.splice(destination.index, 0, movedTask);
//       setTaskLists(
//         taskLists.map((list) =>
//           list.id === source.droppableId
//             ? { ...list, tasks: sourceTasks }
//             : list
//         )
//       );
//     } else {
//       const destinationTasks = Array.from(destinationList.tasks);
//       destinationTasks.splice(destination.index, 0, movedTask);

//       setTaskLists(
//         taskLists.map((list) => {
//           if (list.id === source.droppableId)
//             return { ...list, tasks: sourceTasks };
//           if (list.id === destination.droppableId)
//             return { ...list, tasks: destinationTasks };
//           return list;
//         })
//       );
//     }
//   };

//   const addTask = (listId: string) => {
//     const taskContent = prompt("Enter task content:");
//     if (!taskContent) return;

//     const newTask: Task = { id: uuidv4(), content: taskContent };
//     setTaskLists(
//       taskLists.map((list) =>
//         list.id === listId ? { ...list, tasks: [...list.tasks, newTask] } : list
//       )
//     );
//   };

//   const addTaskList = () => {
//     const taskContent = prompt("Enter task list title:");
//     if (!taskContent) return;

//     const newTaskList: TaskList = {
//       id: uuidv4(),
//       title: taskContent,
//       tasks: [],
//     };
//     setTaskLists((prev) => [...prev, newTaskList]);
//   };

//   const deleteTaskList = (listId: string) => {
//     if (!listId) return;

//     setTaskLists((prev) => prev.filter((list) => list.id !== listId));
//   };

//   const deleteTask = (listId: string, taskId: string) => {
//     const newTaskList = taskLists.map((list) => {
//       if (list.id === listId) {
//         const newTasks = list.tasks.filter((task) => task.id !== taskId);
//         return { ...list, tasks: newTasks };
//       }
//       return list;
//     });

//     setTaskLists(newTaskList);
//   };

//   const saveTasks = () => {
//     console.log("Saved Task Lists:", taskLists);
//   };

//   return (
//     <div className=" p-4">
//       <button
//         onClick={addTaskList}
//         className="m-2 rounded bg-blue-500 p-2 text-white"
//       >
//         Add New List
//       </button>
//       <DragDropContext onDragEnd={onDragEnd}>
//         <Droppable droppableId="board" type="list" direction="horizontal">
//           {(provided) => (
//             <div
//               ref={provided.innerRef}
//               {...provided.droppableProps}
//               className="flex space-x-4"
//             >
//               {taskLists.map((list, index) => (
//                 <Draggable key={list.id} draggableId={list.id} index={index}>
//                   {(provided) => (
//                     <div
//                       ref={provided.innerRef}
//                       {...provided.draggableProps}
//                       className="w-64 min-w-52 rounded-md bg-gray-100  shadow-md"
//                     >
//                       <div
//                         {...provided.dragHandleProps}
//                         className="mb-2 flex items-center justify-between px-4 py-2 text-lg font-bold hover:bg-brand-500/30"
//                       >
//                         <h2 className=" cursor-grab ">{list.title}</h2>
//                         <MdDelete
//                           onClick={() => deleteTaskList(list.id)}
//                           className="cursor-pointer text-red-500"
//                         />
//                       </div>

//                       <Droppable droppableId={list.id} type="task">
//                         {(provided) => (
//                           <div
//                             ref={provided.innerRef}
//                             {...provided.droppableProps}
//                             className="scrollbar-hide hover:scrollbar-show h-80 overflow-y-auto overflow-x-hidden px-3 py-2"
//                           >
//                             {list.tasks.map((task, index) => (
//                               <Draggable
//                                 key={task.id}
//                                 draggableId={task.id}
//                                 index={index}
//                               >
//                                 {(provided) => (
//                                   <div
//                                     ref={provided.innerRef}
//                                     {...provided.draggableProps}
//                                     {...provided.dragHandleProps}
//                                     className="mb-2 flex w-full items-center justify-between rounded bg-white p-2 shadow"
//                                   >
//                                     {task.content}

//                                     <MdDelete
//                                       onClick={() =>
//                                         deleteTask(list.id, task.id)
//                                       }
//                                       className="cursor-pointer text-red-500"
//                                     />
//                                   </div>
//                                 )}
//                               </Draggable>
//                             ))}
//                             {provided.placeholder}
//                           </div>
//                         )}
//                       </Droppable>

//                       <button
//                         onClick={() => addTask(list.id)}
//                         className="m-2 rounded bg-blue-500 p-2 text-white"
//                       >
//                         Add Task
//                       </button>
//                     </div>
//                   )}
//                 </Draggable>
//               ))}
//               {provided.placeholder}
//             </div>
//           )}
//         </Droppable>
//       </DragDropContext>

//       <button
//         onClick={saveTasks}
//         className="mt-4 rounded bg-green-500 p-2 text-white"
//       >
//         Save Order
//       </button>
//     </div>
//   );
// };

// export default TaskBoard;
