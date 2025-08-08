"""
测试内嵌SQL功能的Python文件
这个文件用于测试sqlsurge插件对Python中内嵌SQL的支持
"""

import mysql.connector
from typing import List, Dict, Any


def raw_sql(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """
    执行原始SQL查询的函数
    """
    # 连接到MySQL数据库
    conn = mysql.connector.connect(
        host="127.0.0.1",
        port=13306,
        user="dbuser",
        password="dbpass",
        database="test_db",
    )
    cursor = conn.cursor(dictionary=True)

    # 执行查询
    cursor.execute(query, params)
    results = cursor.fetchall()

    conn.close()
    return results


def test_basic_queries():
    """测试基本SQL查询"""

    # 测试1: 简单查询
    users = raw_sql("""
        SELECT id, name, email, age
        FROM users
        WHERE age > 25
        ORDER BY age DESC
    """)
    print("年龄大于25的用户:", users)

    # 测试2: 带参数的查询
    young_users = raw_sql(
        """
        SELECT name, email
        FROM users
        WHERE age < %s
        ORDER BY name
    """,
        (30,),
    )
    print("年龄小于30的用户:", young_users)

    # 测试3: 聚合查询
    stats = raw_sql("""
        SELECT
            COUNT(*) as total_users,
            AVG(age) as avg_age,
            MIN(age) as min_age,
            MAX(age) as max_age
        FROM users
    """)
    print("用户统计:", stats)


def test_complex_queries():
    """测试复杂SQL查询"""

    # 测试4: 子查询
    above_avg_users = raw_sql("""
        SELECT name, age
        FROM users
        WHERE age > (
            SELECT AVG(age)
            FROM users
        )
    """)
    print("年龄高于平均值的用户:", above_avg_users)

    # 测试5: CASE语句
    user_categories = raw_sql("""
        SELECT
            name,
            age,
            CASE
                WHEN age < 26 THEN '年轻'
                WHEN age < 30 THEN '中年'
                ELSE '成熟'
            END as age_category
        FROM users
        ORDER BY age
    """)
    print("用户年龄分类:", user_categories)


def test_f_string_queries():
    """测试f-string格式的SQL查询"""

    min_age = 25
    order_by = "name"

    # 测试6: f-string查询 (注意：实际使用中要小心SQL注入)
    query = f"""
        SELECT id, name, email, age
        FROM users
        WHERE age >= {min_age}
        ORDER BY {order_by}
    """

    result = raw_sql(query)
    print(f"年龄大于等于{min_age}的用户(按{order_by}排序):", result)

    # 测试7: 更复杂的f-string查询
    table_name = "users"
    columns = "name, email"
    condition = "age BETWEEN 25 AND 30"

    dynamic_query = f"""
        SELECT {columns}
        FROM {table_name}
        WHERE {condition}
    """

    result = raw_sql(dynamic_query)
    print("动态查询结果:", result)


def test_multiline_sql():
    """测试多行SQL语句"""

    # 测试8: 复杂的多行查询 (MySQL 5.7兼容版本)
    complex_result = raw_sql("""
        SELECT
            CASE
                WHEN age < 27 THEN 'Group A'
                ELSE 'Group B'
            END as user_group,
            COUNT(*) as count,
            AVG(age) as avg_age
        FROM users
        GROUP BY
            CASE
                WHEN age < 27 THEN 'Group A'
                ELSE 'Group B'
            END
        ORDER BY user_group
    """)
    print("用户分组统计:", complex_result)


if __name__ == "__main__":
    print("=== 测试sqlsurge插件的内嵌SQL功能 ===")
    print()

    test_basic_queries()
    print()

    test_complex_queries()
    print()

    test_f_string_queries()
    print()

    test_multiline_sql()
    print()

    print("=== 测试完成 ===")
