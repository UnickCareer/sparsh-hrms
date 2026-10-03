// src/pages/EmployeeDirectory.jsx
import { useState, useEffect } from "react";
import { Phone, Mail, MapPin } from "lucide-react";

function getInitials(fullName) {
    return fullName
        .split(" ")
        .map((word) => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function EmployeeDirectory() {

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState("All");

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/employees");
                const data = await response.json();

                if (data.success) {
                    setEmployees(data.employees);
                } else {
                    setError("Could not load employees.");
                }
            } catch (err) {
                console.error(err);
                setError("Could not connect to the server.");
            } finally {
                setLoading(false);
            }
        };

        fetchEmployees();
    }, []);

    const departments = ["All", ...new Set(employees.map((emp) => emp.department))];

    const filteredEmployees = employees.filter((employee) => {
        const matchesSearch = employee.full_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

        const matchesDepartment =
            selectedDepartment === "All" || employee.department === selectedDepartment;

        return matchesSearch && matchesDepartment;
    });

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Employee Directory</h1>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input 
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 outline-none"  
                />

                <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 outline-none"
                >
                    {departments.map((dept) => (
                        <option key={dept} value={dept}>
                            {dept}
                        </option>
                    ))}
                </select>
            </div>

            {loading && (
                <p className="text-gray-500 text-center mt-10">Loading employees...</p>
            )}

            {!loading && error && (
                <p className="text-red-500 text-center mt-10">{error}</p>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredEmployees.map((employee) => {
                        const isAdmin = employee.role === "admin";

                        return (
                            <div key={employee.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">

                                <div
                                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm mb-3 ${
                                        isAdmin ? "bg-purple-600" : "bg-orange-500"
                                    }`}
                                >
                                    {getInitials(employee.full_name)}
                                </div>

                                <h2 className="text-gray-900 text-base font-semibold">{employee.full_name}</h2>
                                <p className="text-gray-500 text-sm">{employee.designation}</p>
                                <p className="text-gray-500 text-sm">{employee.department}</p>

                                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-2">
                                    <MapPin size={13} />
                                    <span>{employee.location}</span>
                                </div>

                                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-sm font-medium mt-2">
                                    <Phone size={13} />
                                    <span>{employee.phone}</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-2">
                                    <Mail size={13} />
                                    <span>{employee.email}</span>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && !error && filteredEmployees.length === 0 && (
                <p className="text-gray-500 text-center mt-10">No employees found.</p>
            )}
        </div>
    );
}

export default EmployeeDirectory;