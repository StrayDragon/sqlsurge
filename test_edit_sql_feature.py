# Test file for the new Edit SQL in Temporary File feature

def test_sql_extraction():
    # This is a test SQL query that should be extractable
    query = """
    SELECT 
        users.id,
        users.name,
        orders.total
    FROM users
    JOIN orders ON users.id = orders.user_id
    WHERE users.active = 1
    ORDER BY orders.total DESC
    LIMIT 10
    """
    
    # Another SQL query for testing
    another_query = """
    UPDATE products 
    SET price = price * 1.1 
    WHERE category = 'electronics'
    """
    
    return query, another_query

if __name__ == "__main__":
    q1, q2 = test_sql_extraction()
    print("Test queries created successfully")