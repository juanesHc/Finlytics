import os

def validateData(data , messageError):
    if data is None:
        print(messageError)
        return False
    else:
        return True
    
def getDataFromEnv(data):
    return os.environ[data]