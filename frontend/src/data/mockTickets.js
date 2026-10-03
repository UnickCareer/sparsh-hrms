// src/data/mockTickets.js

const mockTickets = [
    {
        id: "TKT-1001",
        subject: "Outlook not opening",
        category: "Software",
        priority: "High",
        status: "Open",
        requester: "Mohit Null",
        assignee: "IT Team",
        updates: 2,
        raised: "2026-07-18",
        description:
            "Microsoft Outlook is not opening on the employee's laptop. The application closes immediately after launching.",
        attachment: "",
        updateHistory: [
            {
                id: 1,
                author: "IT Team",
                text: "Issue received and ticket is being reviewed.",
                date: "2026-07-18T10:15:00",
            },
            {
                id: 2,
                author: "IT Team",
                text: "Checking Outlook profile and application logs.",
                date: "2026-07-18T11:05:00",
            },
        ],
    },

    {
        id: "TKT-1002",
        subject: "Laptop Wi-Fi disconnecting",
        category: "Network",
        priority: "Medium",
        status: "In Progress",
        requester: "Aman",
        assignee: "IT Team",
        updates: 1,
        raised: "2026-07-20",
        description:
            "Wi-Fi connection disconnects randomly during office hours. Internet works normally on other devices.",
        attachment: "",
        updateHistory: [
            {
                id: 3,
                author: "IT Team",
                text: "Network adapter drivers are being checked.",
                date: "2026-07-20T14:20:00",
            },
        ],
    },

    {
        id: "TKT-1003",
        subject: "Access required for HR portal",
        category: "Access/Login",
        priority: "Low",
        status: "Resolved",
        requester: "Sunny",
        assignee: "Rahul",
        updates: 2,
        raised: "2026-07-21",
        description:
            "Employee was unable to access the HR portal because the required access permission was missing.",
        attachment: "",
        updateHistory: [
            {
                id: 4,
                author: "Rahul",
                text: "Verified the employee account and required permissions.",
                date: "2026-07-21T09:30:00",
            },
            {
                id: 5,
                author: "Rahul",
                text: "Access permission added successfully.",
                date: "2026-07-21T10:10:00",
            },
        ],
    },

    {
        id: "TKT-1004",
        subject: "Keyboard replacement required",
        category: "Hardware",
        priority: "Medium",
        status: "Closed",
        requester: "Rajeev",
        assignee: "IT Team",
        updates: 3,
        raised: "2026-07-22",
        description:
            "Several keys on the employee keyboard are not responding and the keyboard requires replacement.",
        attachment: "",
        updateHistory: [
            {
                id: 6,
                author: "IT Team",
                text: "Hardware issue confirmed.",
                date: "2026-07-22T10:00:00",
            },
            {
                id: 7,
                author: "IT Team",
                text: "Replacement keyboard issued to the employee.",
                date: "2026-07-22T13:15:00",
            },
            {
                id: 8,
                author: "IT Team",
                text: "Ticket closed after replacement was confirmed.",
                date: "2026-07-22T15:30:00",
            },
        ],
    },

    {
        id: "TKT-1005",
        subject: "Printer not responding",
        category: "Hardware",
        priority: "High",
        status: "Reopened",
        requester: "Mohit Null",
        assignee: "Aman",
        updates: 2,
        raised: "2026-07-23",
        description:
            "Office printer stopped responding after working normally earlier in the day. The issue returned after the previous fix.",
        attachment: "",
        updateHistory: [
            {
                id: 9,
                author: "Aman",
                text: "Printer connection was restored temporarily.",
                date: "2026-07-23T11:00:00",
            },
            {
                id: 10,
                author: "Mohit Null",
                text: "Printer stopped responding again.",
                date: "2026-07-23T15:45:00",
            },
        ],
    },
];

export default mockTickets;